<h1 align="center"> Securiox: Zero-Knowledge AI Document Vault </h1>
The concept of secure cloud storage combined with AI-driven insights is often fragmented. You either surrender your data for AI capabilities, or you prioritize security at the exact cost of utility. In this repo, I will take you through Securiox, an end-to-end encrypted file management system with integrated Retrieval-Augmented Generation (RAG) that lets you securely chat with your private documents.

## 🔍 Overview
This project implements a **highly secure document vault and AI assistant** utilizing a modern Next.js ecosystem. The platform encrypts user files client-side using a hybrid approach of RSA and AES cryptography before uploading. It then dynamically extracts text to generate semantic vector embeddings, leveraging **LangChain**, **Pinecone**, and cutting-edge LLMs (like Google Gemini and Groq) for intelligent, context-aware chatting. 

Securiox ensures that your data remains fundamentally yours, maintaining absolute privacy while offering true semantic document intelligence.

---

## 🧠 Problem Statement
Given the rapid rise of data breaches and aggressive data scraping by AI entities, individuals and enterprises need a way to store heterogeneous documents (PDFs, DOCX, Images, Text) with absolute cryptographic security, while still being able to effortlessly extract intelligence, summaries, and insights without exposing plain-text data to unauthorized centralized servers.

---

## 🛠️ Tech Stack
- **Next.js 14/15 & React** – Full-stack framework & dynamic UI rendering
- **PostgreSQL & Prisma** – Relational database and type-safe ORM
- **Tailwind CSS & Heroicons** – Rapid, responsive styling and iconography
- **NextAuth.js** – Robust authentication and session lifecycle management
- **Cryptography** (`crypto-js`, `bcryptjs`, `jsencrypt`) – Hybrid RSA & AES encryption, plus MFA (TOTP via `otplib`)
- **LangChain** – LLM orchestration, text splitting, and RAG pipelining
- **Pinecone** – High-dimensional Vector Database for semantic search
- **Groq AI inference** – Fast, intelligent LLM inference engines (model: 'openai/gpt-oss-120b') & (model: 'llama-3.3-70b-versatile')
- **Gemini embeddings** - for embeddings generation
- **Cloudinary** – Reliable remote storage for AES-encrypted binary blobs
- **pdfjs-dist & Mammoth** – Rich document text extraction (PDF & Word)

---

## 🔄 Project Workflow
1. **Secure Authentication:** User logs in via NextAuth and completes Time-based One-Time Password (TOTP) MFA verification.
2. **Key Generation:** A unique RSA key pair is generated; the private key is heavily encrypted via the user's master passphrase before hitting the database.
3. **Hybrid Encryption Upload:** During file upload, the file is aggressively encrypted client-side with a unique AES key. This AES key is subsequently encrypted using the user's RSA public key.
4. **Blob Storage:** The encrypted file payload is securely stored via Cloudinary.
5. **Document Ingestion:** A robust local script extracts raw text from complex file types (PDF, Word).
6. **Vectorization:** LangChain chunks the text and generates dense vector embeddings, storing them in Pinecone seamlessly mapped to the encrypted file metadata.
7. **Semantic Retrieval:** When querying the AI, the user's prompt is vectorized to retrieve only the most semantically relevant file chunks.
8. **Generation:** Gemini/Groq synthesizes a precise, context-aware response natively referencing the user's private documents.

---

## 📂 Database Schema Overview
- **User Model:** Tracks authentication, encrypted RSA private keys, public keys, and MFA secrets.
- **EncryptedFile Model:** Acts as the ledger for files, mapping Cloudinary public IDs, the RSA-wrapped AES keys for that specific file, and tracking vectorization status.
- **ChatSession & ChatMessage:** Relational tracking of the AI conversation history tied directly back to the authenticated user.

---

## 🛡️ How Securiox is Better Than Others
- **True Zero-Knowledge Architecture:** Unlike standard Google Drive or Notion, the server *never* sees your raw files. Everything is AES-GCM encrypted before storage. If the database is breached, the attacker merely gets cryptographic noise.
- **Privacy-Preserving AI (RAG):** Instead of pasting highly sensitive documents directly into ChatGPT (and forfeiting your IP), Securiox acts as a contextual firewall. It retrieves only exact semantic chunks via Pinecone and provides strict context boundaries to the LLM.
- **Hardware-Agnostic MFA:** Native, robust Time-based One-Time Password (TOTP) implementations ensuring protection against brute-force and credential stuffing attacks.
- **Local Parsing Agents:** Uses local workers for text extraction (`pdfjs-dist` / `mammoth`), meaning the unencrypted payload never transverses an external parsing API network.

---

## 🚀 Future Enhancements (Technical Suggestions)
*As we look to scale this project, here are my top architectural recommendations for V2:*

- **Implement Streaming UI Responses:** Transition the `/api/chat` route to use Server-Sent Events (SSE) or the Vercel AI SDK to stream responses chunk-by-chunk. This drastically reduces perceived latency for large LLM generations.
- **Local LLM Integration (Air-gapped Mode):** Integrate `Ollama` or `llama.cpp` to run lightweight models (like Llama-3 8B) directly on the host machine. This would bypass Gemini/Groq entirely, achieving 100% cloud-free, air-gapped privacy.
- **Semantic Chunking:** Upgrade LangChain's recursive character splitting to true *Semantic Chunking*. This ensures that complex paragraphs or legal clauses remain intact in the vector space, massively improving the RAG recall accuracy.
- **Hybrid Search (Dense + Sparse):** Upgrade Pinecone queries to use hybrid search by combining dense vector embeddings with sparse keyword search (BM25). This fixes AI hallucination when searching for highly specific names, IDs, or acronyms in documents.
- **Web Workers for Crypto Execution:** Offload the heavy RSA/AES encryption cycles to browser Web Workers. This will prevent the main UI thread from freezing or dropping frames when users upload massive files (>50MB).

---

## 📌 Key Learnings
- Building end-to-end encrypted data flows mapped seamlessly to Next.js server actions.
- Designing enterprise-grade RAG pipelines utilizing LangChain and Pinecone.
- Complex state management for handling asymmetric and symmetric keys in browser environments.
- Bridging the gap between absolute privacy and high-utility AI intelligence.

---

⭐ If you find this architecture useful, consider starring the repository!
