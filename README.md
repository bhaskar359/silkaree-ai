# Silkaree AI — AI-Powered Indian Saree Discovery

Silkaree AI helps customers discover Indian handloom and silk sarees using **Gemma 4** hosted on the **Gemini API** (`@google/genai`):

1. **Multimodal Image Search (`POST /api/search/image`)**: Upload a saree photograph in memory. Gemma 4 extracts observable visual estimates (dominant tones, motifs/borders, apparent fabric/texture, and occasion style), and Node.js deterministically ranks matching sarees from `server/data/sarees.json`.
2. **Natural-Language Saree Search (`POST /api/search/text`)**: Enter plain-language requests (e.g. *"I want a traditional silk saree for a wedding under ₹7,000."*). Gemma 4 extracts structured shopping preferences, returning **Section A: Available in Silkaree** with strict stock verification (`In stock` vs `Availability unverified`).
3. **External Saree Inspiration Search (`POST /api/search/inspiration`)**: When the local catalogue has no matches or only partial matches (e.g. *"Dark green Uppada silk saree with intricate gold motifs"* or *"Purple Paithani silk saree with peacock pallu"*), Gemma 4 generates focused saree search queries and Google Search grounded web citations, and retrieves external saree inspiration images (**Section B: Discover More Designs**) with full source attribution (`Inspiration · Not in current catalogue`) and a **Request This Style** custom-weaving enquiry modal.

## External Image Search Provider Abstraction

Configured in `server/inspirationProvider.ts` (`INSPIRATION_PROVIDER="auto"` by default):
- **Google Programmable Search Engine (`google-cse`)**: Used automatically when `GOOGLE_CSE_API_KEY` and `GOOGLE_CSE_CX` are set in `.env`.
- **Wikimedia Commons Open Media API (`wikimedia-commons`)**: Documented keyless MediaWiki API returning verified external saree photographs with original `commons.wikimedia.org` source links and creator attribution when Google CSE credentials are not configured.
- **Curated Sample Fallback (`sample-fallback`)**: Clearly labelled demo fallback used if external providers are unavailable or disabled (`INSPIRATION_PROVIDER="sample-fallback"`). Never presented as live Google Search results.

## Local Setup & Startup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and configure your Gemini API key:
   ```bash
   cp .env.example .env
   ```

3. Start the full-stack server on `http://localhost:3000`:
   ```bash
   npm run dev
   ```
