import io
import json
import logging
import wave
from dataclasses import dataclass
from pathlib import Path
from typing import List, Mapping, Optional, Sequence, Union
import base64
import numpy as np
import onnxruntime
from espeak_phonemizer import Phonemizer
from transformers.pipelines.audio_utils import ffmpeg_read
import asyncio
import nats
from tqdm import tqdm
import time
import csv
import jiwer
import torch
import numpy as np
from transformers import pipeline
from transformers.pipelines.audio_utils import ffmpeg_read
import concurrent.futures
import warnings
warnings.filterwarnings("ignore", category=UserWarning, message="Using `max_length`'s default")
warnings.filterwarnings("ignore", category=UserWarning, message="You seem to be using the pipelines sequentially on GPU")

_BOS = "^"
_EOS = "$"
_PAD = "_"

_LOGGER = logging.getLogger(__name__)

@dataclass
class PiperConfig:
    num_symbols: int
    num_speakers: int
    sample_rate: int
    espeak_voice: str
    length_scale: float
    noise_scale: float
    noise_w: float
    phoneme_id_map: Mapping[str, Sequence[int]]


class Piper:
    def __init__(
        self,
        model_path: Union[str, Path],
        config_path: Optional[Union[str, Path]] = None,
        use_cuda: bool = False,
    ):
        if config_path is None:
            config_path = f"{model_path}.json"

        self.config = load_config(config_path)
        self.phonemizer = Phonemizer(self.config.espeak_voice)
        self.model = onnxruntime.InferenceSession(
            str(model_path),
            sess_options=onnxruntime.SessionOptions(),
            providers=["CPUExecutionProvider"]
            if not use_cuda
            else ["CUDAExecutionProvider"],
        )

    def synthesize(
        self,
        text: str,
        speaker_id: Optional[int] = None,
        length_scale: Optional[float] = None,
        noise_scale: Optional[float] = None,
        noise_w: Optional[float] = None,
    ) -> bytes:
        """Synthesize WAV audio from text."""
        if length_scale is None:
            length_scale = self.config.length_scale

        if noise_scale is None:
            noise_scale = self.config.noise_scale

        if noise_w is None:
            noise_w = self.config.noise_w

        phonemes_str = self.phonemizer.phonemize(text)
        phonemes = [_BOS] + list(phonemes_str)
        phoneme_ids: List[int] = []

        for phoneme in phonemes:
            if phoneme in self.config.phoneme_id_map:
                phoneme_ids.extend(self.config.phoneme_id_map[phoneme])
                phoneme_ids.extend(self.config.phoneme_id_map[_PAD])
            else:
                _LOGGER.warning("No id for phoneme: %s", phoneme)

        phoneme_ids.extend(self.config.phoneme_id_map[_EOS])

        phoneme_ids_array = np.expand_dims(np.array(phoneme_ids, dtype=np.int64), 0)
        phoneme_ids_lengths = np.array([phoneme_ids_array.shape[1]], dtype=np.int64)
        scales = np.array(
            [noise_scale, length_scale, noise_w],
            dtype=np.float32,
        )

        if (self.config.num_speakers > 1) and (speaker_id is not None):
            # Default speaker
            speaker_id = 0

        sid = None

        if speaker_id is not None:
            sid = np.array([speaker_id], dtype=np.int64)

        # Synthesize through Onnx
        input_names = ["input", "input_lengths", "scales", "sid"]
        input_feed = {
            "input": phoneme_ids_array,
            "input_lengths": phoneme_ids_lengths,
            "scales": scales,
            "sid": sid if sid is not None else np.zeros((1,), dtype=np.int64),
        }

        output = self.model.run(["output"], input_feed)[0].squeeze((0, 1))
        audio = audio_float_to_int16(output.squeeze())

        # Convert to WAV
        with io.BytesIO() as wav_io:
            wav_file: wave.Wave_write = wave.open(wav_io, "wb")
            with wav_file:
                wav_file.setframerate(self.config.sample_rate)
                wav_file.setsampwidth(2)
                wav_file.setnchannels(1)
                wav_file.writeframes(audio.tobytes())

            return wav_io.getvalue()



def load_config(config_path: Union[str, Path]) -> PiperConfig:
    with open(config_path, "r", encoding="utf-8") as config_file:
        config_dict = json.load(config_file)
        inference = config_dict.get("inference", {})

        return PiperConfig(
            num_symbols=config_dict["num_symbols"],
            num_speakers=config_dict["num_speakers"],
            sample_rate=config_dict["audio"]["sample_rate"],
            espeak_voice=config_dict["espeak"]["voice"],
            noise_scale=inference.get("noise_scale", 0.667),
            length_scale=inference.get("length_scale", 1.0),
            noise_w=inference.get("noise_w", 0.8),
            phoneme_id_map=config_dict["phoneme_id_map"],
        )


def audio_float_to_int16(
    audio: np.ndarray, max_wav_value: float = 32767.0
) -> np.ndarray:
    """Normalize audio and convert to int16 range"""
    audio_norm = audio * (max_wav_value / max(0.01, np.max(np.abs(audio))))
    audio_norm = np.clip(audio_norm, -max_wav_value, max_wav_value)
    audio_norm = audio_norm.astype("int16")
    return audio_norm


# Create an instance of the Piper class

piper = Piper(model_path="./en_US-libritts-high.onnx", config_path="./en_US-libritts-high.onnx.json")

async def piperCallback(msg):
    payload = msg.data.decode("utf-8")
    wav = piper.synthesize(payload)
    wav_base64 = base64.b64encode(wav).decode('utf-8')
    base64_audio = f"data:audio/mpeg;base64,{wav_base64}".encode()
    
    await msg.respond(
        base64_audio
    )

    

async def sub():
    # Connect to NATS server
    nc = await nats.connect(servers=["nats://nats_local:4222"], user="piper_tts", password="password")
    sub = await nc.subscribe("service.tts", "tts_group",cb=piperCallback)
    print("got sub", sub)


loop = asyncio.new_event_loop()
asyncio.set_event_loop(loop)
loop.create_task(sub())
loop.run_forever()