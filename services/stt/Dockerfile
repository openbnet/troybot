FROM lambda-stack:22.04

# install python3-pip
RUN apt update && apt install -y python3-pip  wget ffmpeg 

# Installs the wheel compatible with CUDA 11 and cuDNN 8.6 or newer.
# Note: wheels only available on linux.
RUN pip install --upgrade "jax[cuda11_local]" -f https://storage.googleapis.com/jax-releases/jax_cuda_releases.html

# Install Jupyter Notebook and other dependencies
RUN pip install jupyter numba typing datasets>=2.6.1 git+https://github.com/huggingface/transformers@de9255de27abfcae4a1f816b904915f0b1e23cd9 git+https://github.com/huggingface/peft.git git+https://github.com/huggingface/accelerate.git gradio huggingface_hub librosa evaluate>=0.30 jiwer

RUN pip install pip install --upgrade traitlets

RUN pip install nats.py soundfile openai-whisper

# Set the working directory
WORKDIR /app

COPY . /app

CMD ["python", "nats_stt.py"]
