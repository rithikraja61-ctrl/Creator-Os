Creator OS 🚀

AI-powered Creator Backoffice built with Lemma

Creator OS helps creators capture ideas from multiple sources, organize them into meaningful themes, and generate publish-ready content using AI.

✨ Features
📝 Capture ideas from Notes, URLs, Bookmarks, Tweets, PDFs, Screenshots, and Chats
🧠 AI-powered Theme Clustering
✍️ AI Content Writer
✅ AI Content Reviewer
📚 Knowledge Base for all collected ideas
📋 Content Queue management
🔍 Semantic Search (Vector Search)
🤖 Multi-Agent workflow using Lemma
Problem

Creators collect ideas across dozens of apps:

Notes
Screenshots
Twitter/X
ChatGPT
Bookmarks
PDFs
Websites

These ideas become scattered and are rarely converted into useful content.

Creator OS solves this by providing one centralized AI workspace.

Solution

Creator OS automatically:

Captures ideas
Stores them in a structured knowledge base
Clusters similar ideas into themes
Generates high-quality content
Reviews AI-generated content
Organizes drafts into a publishing workflow
Tech Stack
Frontend
React
TypeScript
Vite
TanStack Query
Backend
Lemma Platform
Lemma SDK
AI Agents
Workflows
Vector Search
AI
Theme Clusterer Agent
Writer Agent
Reviewer Agent
Architecture
Idea Sources
     │
     ▼
 Idea Inbox
     │
     ▼
 Knowledge Base
     │
     ▼
 Theme Clusterer (AI)
     │
     ▼
 Theme Database
     │
     ▼
 Writer Agent
     │
     ▼
 Review Agent
     │
     ▼
 Content Queue
Project Structure
creator-os/

├── src/
├── creator-pod/
│   ├── agents/
│   ├── workflows/
│   ├── tables/
│   └── functions/
├── apps/
├── package.json
└── README.md
Demo Workflow
Add a new idea.
Store it in the Knowledge Base.
AI clusters related ideas.
Select a theme.
Generate content.
AI reviews the draft.
Move it to the Content Queue.
![Dashboard](https://github.com/rithikraja61-ctrl/Creator-Os/blob/bbd7a164549ba9ebcebe81836e6efa41f30724fa/Screenshot%202026-07-02%20121708.png)

![Idea Inbox](https://github.com/rithikraja61-ctrl/Creator-Os/blob/bbd7a164549ba9ebcebe81836e6efa41f30724fa/Screenshot%202026-07-02%20121721.png)

![Knowledge Base](https://github.com/rithikraja61-ctrl/Creator-Os/blob/bbd7a164549ba9ebcebe81836e6efa41f30724fa/Screenshot%202026-07-02%20121737.png)

![Theme](https://github.com/rithikraja61-ctrl/Creator-Os/blob/bbd7a164549ba9ebcebe81836e6efa41f30724fa/Screenshot%202026-07-02%20121749.png)
![AI Writer]([images/ai-writer.png](https://github.com/rithikraja61-ctrl/Creator-Os/blob/bbd7a164549ba9ebcebe81836e6efa41f30724fa/Screenshot%202026-07-02%20121801.png))

![Content Queue](https://github.com/rithikraja61-ctrl/Creator-Os/blob/bbd7a164549ba9ebcebe81836e6efa41f30724fa/Screenshot%202026-07-02%20121812.png)

![Review](https://github.com/rithikraja61-ctrl/Creator-Os/blob/bbd7a164549ba9ebcebe81836e6efa41f30724fa/Screenshot%202026-07-02%20121822.png)
