# SmolDocling 256M WebGPU Demo



This project is a demo using the **SmolDocling-256M** model to perform document understanding tasks. Allowing you to transform document images into structured formats like Markdown and JSON, and more!

**Try it out on Hugging Face** [Link soon]

## Features

-   **Intelligent Content Extraction**: Extracts structures from documents, like:
    -   Tables 
    -   Math formulas (converted to LaTeX)
    -   Code blocks 
-   **Structured Output**: Converts document content into markdown and JSON
-   **Region-Specific Processing**: Select a specific area of the document to process only the content you need.
-   **Fully Offline**: All processing happens on your device in the browser. Your data never leaves your computer.


## 🚀 Getting Started
To run this project locally, follow these steps:

1.  Clone the repo
    ```bash
    git clone https://github.com/callbacked/smoldocling256M-webgpu
    ```
2.  Navigate to the project directory
    ```bash
    cd smoldocling256M-webgpu
    ```
3.  Install NPM packages
    ```bash
    npm install
    ```

4. Run

```bash
npm run dev
```

This will start the Vite development server, and you can view the application at `http://localhost:5173` (or another port if 5173 is in use).

### Building for Production

To create a production build:

```bash
npm run build
```

