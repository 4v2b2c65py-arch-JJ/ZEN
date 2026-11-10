# GGUF Model Installer — Quantized Model Management

Installs GGUF-format quantized models from datasets (HuggingFace, proxy) into `./models/gguf/`.

## Features

- Search GGUF models via proxy
- Download and install GGUF models with progress tracking
- List installed models with quantization type
- Remove models
- Weight class: `daemond`

## Usage

```ts
const gguf = createGGUFManager("./models/gguf", "daemond", "http://localhost:3334");

const datasets = await gguf.listDatasets();
const results = await gguf.searchGGUF("llama-3.1-8b", "huggingface-gguf");

const model = await gguf.installGGUFFromDataset(
  "meta-llama/Llama-3.1-8B-Instruct",
  "Llama 3.1 8B",
  "https://huggingface.co/.../llama-3.1-8b-instruct.Q4_K_M.gguf",
  "llama-3.1-8b-instruct.Q4_K_M.gguf",
  "Q4_K_M",
);

const progress = gguf.getInstallProgress(installId);
console.log(`Download: ${progress.percentage}%`);
```

## CLI

```bash
npx tsx src/gguf/cli.ts
```

## Requirements

- Model proxy running on `:3334` for dataset proxying
- Disk space for GGUF files (2GB-100GB per model)
