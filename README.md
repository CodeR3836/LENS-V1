# 🔍 LENS V1

> **A lightweight Windows desktop AI text assistant — capture, understand, transform, and interact with text instantly.**

LENS is a lightweight AI-powered Windows desktop application built to make working with text faster and more convenient.

It allows users to **translate, rewrite, summarize, and ask AI questions about text** directly from their desktop. LENS can also capture text from the screen using a **Crop/Select → OCR pipeline**, making it possible to work with text that cannot be directly copied.

---

## ✨ Features

### 🌐 Translate

Translate text between multiple languages with support for automatic source-language detection.

* Automatic language detection
* Multiple source and target languages
* Clean translation interface
* AI-powered translation
* Default target language support
* Designed for quick desktop workflows

---

### ✍️ Rewrite

Transform existing text according to the user's desired writing style.

Supported rewrite modes:

* **Fix Grammar** — Correct grammar, spelling, and punctuation
* **Professional Touch** — Make the text more professional
* **Touch-up** — Improve wording while preserving the original meaning
* **Academic** — Make the writing more formal and academic
* **Short** — Make the text more concise
* **Casual** — Make the text more natural and casual

---

### 📝 Summarize

Turn long text into a concise summary.

Useful for:

* Articles
* Notes
* Research material
* Study content
* Long messages
* Documents

---

### 🤖 Ask AI

Ask questions about selected or captured text.

LENS follows a **context-first approach**:

```text
Text Source
    ↓
Paste / Crop & Select
    ↓
Context Extraction
    ↓
AI
    ↓
Answer
```

Two interaction modes are available:

* **Make Questions**
* **Ask Text**

Text can be supplied through:

* Paste
* Crop / Select

---

## 🖼️ Crop & OCR

One of the core features of LENS is its screen-capture workflow.

Users can select an area of their screen and extract the text from it without manually copying anything.

### Workflow

```text
Floating Launcher
       ↓
     Crop
       ↓
Screen Selection Overlay
       ↓
   Image Capture
       ↓
 Image Preprocessing
       ↓
      OCR
       ↓
Extracted Text
       ↓
      LENS
```

The OCR pipeline is designed to handle different types of screen text, including multilingual content.

### OCR Pipeline

The pipeline includes:

* Screen-region capture
* Image preprocessing
* Scaling
* OCR recognition
* Text extraction
* Language-aware processing
* Result injection into the LENS interface

The project also includes handling for Windows-specific path issues and OCR preprocessing edge cases.

---

## 🪟 Floating Launcher

LENS includes a floating launcher for quick access.

The launcher provides:

* **Crop**
* **Open LENS**

The Crop workflow can automatically open the main LENS interface after the selected screen region has been processed.

This allows the user to go from:

```text
Screen → Select → OCR → LENS
```

without manually switching between applications.

---

## ⚡ Streaming & Cancellation

AI responses can be streamed instead of waiting for the entire response to finish.

LENS also supports cancelling an active AI request.

The application uses an `AbortController` based cancellation mechanism so that an ongoing generation can be stopped cleanly.

```text
User Request
     ↓
AI Provider
     ↓
Streaming Response
     ↓
LENS UI
     ↑
 Abort / Cancel
```

---

# 🧠 AI Architecture

LENS is designed around a modular AI service architecture.

Instead of tightly coupling the UI to a single AI provider, LENS separates:

```text
UI
 ↓
Skill
 ↓
AI Service
 ↓
Provider
 ↓
Model
```

This makes it possible to add or switch AI providers without rewriting the application's core UI logic.

---

## 🧩 Skill System

The application uses a skill-based architecture.

```text
src/
├── skills/
│   ├── TranslateSkill
│   ├── RewriteSkill
│   ├── SummarizeSkill
│   └── AskAISkill
```

Each skill is responsible for defining the behavior and prompt logic required for a specific task.

### Current Skills

| Skill          | Purpose                      |
| -------------- | ---------------------------- |
| TranslateSkill | Translation                  |
| RewriteSkill   | Text transformation          |
| SummarizeSkill | Text summarization           |
| AskAISkill     | Context-based AI interaction |

---

# 🔌 AI Provider System

LENS uses a provider abstraction so different AI backends can be integrated into the same application.

Planned / supported provider architecture includes:

```text
AI Service
│
├── Claude
├── OpenAI
├── Gemini
├── Ollama
├── Custom OpenAI
└── Mock
```

This architecture allows LENS to work with:

* Cloud AI APIs
* Local AI models
* OpenAI-compatible endpoints
* Development/testing providers

---

## 🏗️ Architecture Overview

```text
                    ┌──────────────────┐
                    │    LENS UI       │
                    │ React + Vite     │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │  Skill System    │
                    ├──────────────────┤
                    │ Translate        │
                    │ Rewrite          │
                    │ Summarize        │
                    │ Ask AI           │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │   AI Service     │
                    └────────┬─────────┘
                             │
             ┌───────────────┼───────────────┐
             ▼               ▼               ▼
         Cloud APIs       Ollama       Custom Endpoint
```

---

# 🛠️ Tech Stack

## Frontend

* **React**
* **TypeScript**
* **Vite**
* CSS

## Desktop Runtime

* **Tauri 2**
* Rust

## OCR

* **Tesseract OCR**
* Windows screen capture
* Image preprocessing pipeline

## AI

Provider-agnostic AI service architecture supporting:

* Claude
* OpenAI
* Gemini
* Ollama
* OpenAI-compatible APIs
* Mock provider

---

# 📁 Project Structure

```text
LENS_V1/
│
├── src/
│   ├── components/
│   │
│   ├── skills/
│   │   ├── TranslateSkill
│   │   ├── RewriteSkill
│   │   ├── SummarizeSkill
│   │   └── AskAISkill
│   │
│   ├── services/
│   │   └── ai/
│   │       ├── providers/
│   │       │   ├── Claude
│   │       │   ├── OpenAI
│   │       │   ├── Gemini
│   │       │   ├── Ollama
│   │       │   ├── CustomOpenAI
│   │       │   └── Mock
│   │       │
│   │       └── AI Service
│   │
│   ├── App.tsx
│   ├── App.css
│   └── ...
│
├── src-tauri/
│   ├── src/
│   │
│   ├── icons/
│   │
│   ├── tauri.conf.json
│   └── Cargo.toml
│
├── public/
│
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

> The exact directory contents may change as the project evolves; the structure above represents the main architectural organization of LENS V1.

---

# ⚙️ Requirements

Before running LENS V1, install:

* **Node.js**
* **npm**
* **Rust**
* **Tauri CLI**
* **Tesseract OCR** for OCR functionality

For Windows development, the required Tauri build dependencies must also be installed.

---

# 🚀 Installation

Clone the repository:

```bash
git clone <YOUR_REPOSITORY_URL>
cd LENS_V1
```

Install dependencies:

```bash
npm install
```

---

# ▶️ Development

Start the Vite development server:

```bash
npm run dev
```

For the Tauri desktop development environment:

```bash
npm run tauri dev
```

This launches LENS as a native Windows desktop application.

---

# 🏭 Build

Create a production build:

```bash
npm run build
```

Build the Tauri application:

```bash
npm run tauri build
```

The generated Windows installer/application artifacts will be produced by Tauri's build system.

---

# 🔐 AI Configuration

AI providers can be configured through the application's provider/configuration layer.

Depending on the provider, you may need credentials such as:

```text
OPENAI_API_KEY
ANTHROPIC_API_KEY
GEMINI_API_KEY
```

For local AI:

```text
Ollama
   ↓
Local Model
   ↓
LENS
```

This allows LENS to be used with locally hosted models without sending text to an external API.

**Never commit API keys or other secrets to Git.**

Use environment variables or a local configuration mechanism instead.

---

# 🔍 OCR Configuration

LENS uses Tesseract for OCR.

The OCR subsystem requires:

* Tesseract executable
* Appropriate `tessdata`
* Required language `.traineddata` files
* Correct Windows paths

For multilingual OCR, install the corresponding Tesseract language data.

Example:

```text
tessdata/
├── eng.traineddata
├── ben.traineddata
└── ...
```

The OCR implementation also accounts for Windows path handling and preprocessing issues that can affect recognition quality.

---

# 🎨 UI

The main LENS interface is intentionally compact and optimized for quick interactions.

### Home

```text
┌─────────────────────────────────────┐
│              LENS                   │
│                                     │
│  ┌────────────┐  ┌──────────────┐  │
│  │ Translate  │  │   Rewrite    │  │
│  └────────────┘  └──────────────┘  │
│                                     │
│       ┌──────────────────┐          │
│       │    Summarize     │          │
│       └──────────────────┘          │
│                                     │
│       ┌──────────────────┐          │
│       │      Ask AI      │          │
│       │ Ask about text   │          │
│       └──────────────────┘          │
└─────────────────────────────────────┘
```

The UI is designed around a simple principle:

> **Select text → choose an action → get the result.**

---

# 🧪 Development Status

### LENS V1

| Feature                  | Status |
| ------------------------ | ------ |
| React + Vite UI          | ✅      |
| Tauri 2 Desktop App      | ✅      |
| Translate                | ✅      |
| Rewrite                  | ✅      |
| Summarize                | ✅      |
| Ask AI                   | ✅      |
| Floating Launcher        | ✅      |
| Crop / Select            | ✅      |
| OCR Pipeline             | ✅      |
| Streaming AI             | ✅      |
| Request Cancellation     | ✅      |
| Modular Skill System     | ✅      |
| Provider Architecture    | ✅      |
| Multilingual OCR support | 🚧     |
| Additional AI providers  | 🚧     |

---

# 🐛 Known Limitations

LENS V1 is an active development project.

Potential limitations include:

* OCR accuracy depends on image quality and language data.
* Small or heavily stylized text can reduce OCR confidence.
* Different AI providers may produce different results.
* Some providers require API keys.
* Local AI performance depends on the user's hardware and model.
* Windows-specific OCR/capture behavior may vary between systems.

---

# 🔮 Roadmap

Future versions may include:

* [ ] More AI providers
* [ ] Improved OCR preprocessing
* [ ] Better Bengali / Indic OCR
* [ ] More language support
* [ ] Custom AI model selection
* [ ] Local model management
* [ ] Prompt customization
* [ ] Conversation history
* [ ] Keyboard shortcuts
* [ ] Better clipboard integration
* [ ] Improved floating launcher
* [ ] Global hotkeys
* [ ] Performance optimizations
* [ ] Automatic updates
* [ ] Improved Windows installer experience

---

# 🔒 Privacy

LENS is designed with provider flexibility in mind.

When using a cloud AI provider, selected text may be sent to that provider for processing.

When using a local provider such as Ollama, processing can remain on the user's machine depending on the configuration.

Users should review the privacy policies of any external AI provider they configure.

---

# 🤝 Contributing

Contributions are welcome.

Typical workflow:

```bash
git clone <repository>
cd LENS_V1
npm install
npm run tauri dev
```

Then create a feature branch:

```bash
git checkout -b feature/my-feature
```

Make your changes, test them, and submit a pull request.

---

# 📜 License

License information will be added according to the project's chosen licensing model.

---

# 👨‍💻 Author

**CodeR**

LENS V1 is a personal project focused on combining:

* 🤖 Artificial Intelligence
* 🖥️ Desktop applications
* 👁️ OCR / Computer Vision
* ⚡ Fast interaction workflows
* 🧠 Modular AI systems

---

## ⭐ LENS

**See it. Capture it. Understand it.**

> A lightweight AI text assistant built for fast, context-aware desktop workflows.
