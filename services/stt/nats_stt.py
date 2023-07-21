import asyncio
import nats
import json
import torch
import numpy as np
from transformers import WhisperFeatureExtractor, WhisperTokenizer, AutoProcessor, WhisperForConditionalGeneration

device = "cuda" if torch.cuda.is_available() else "cpu"
MODEL = "eighty88/whisper-medium-sg-50-2-30-part2-30-2"
tokenizer = WhisperTokenizer.from_pretrained(MODEL, language="en", task="transcribe")
feature_extractor = WhisperFeatureExtractor.from_pretrained(MODEL, language="en", task="transcribe")
tokenizer.set_prefix_tokens(language="en", task="transcribe")
processor = AutoProcessor.from_pretrained(MODEL, language="en", task="transcribe")
model = WhisperForConditionalGeneration.from_pretrained(MODEL).to(device)
loop = asyncio.get_running_loop()
subject_main = "service"
subject = "service.stt"

chunk_length = 30.0

def convert_json_to_float32array(data):
    # Convert the JSON data to a Float32Array
    float32array = np.array(list(data.values()), dtype=np.float32)
    return float32array

async def processSTT(msg):
    # decode msg.data into Float32Array from Uint8 of nats. 
    data = json.loads(msg.data.decode())
    
    # Convert JSON data to Float32Array
    float32array = convert_json_to_float32array(data)
    
    inputs = processor(float32array, return_tensors="pt", sampling_rate=16000).input_features.to(device)
    generated_ids = model.generate(inputs=inputs, language="", task="transcribe")
    transcription = processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
    print("transcription", transcription)
    await msg.respond(transcription.encode())

async def sub():
    # Connect to NATS server
    nc = await nats.connect(servers=["nats://192.168.0.210:4222"], user="whisper_stt", password="password")
    print("got nc")
    sub = await nc.subscribe("service.stt", "stt_group", cb=processSTT)
    print("got sub", sub)

loop = asyncio.get_event_loop()
loop.create_task(sub())
loop.run_forever()
