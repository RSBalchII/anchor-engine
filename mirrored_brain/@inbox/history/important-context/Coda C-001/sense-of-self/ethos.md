
---

### **Design Document: The "Ethos" Agent**

#### **1. High-Level Overview**

The **Ethos Agent** is a specialized, lightweight service within the "AI Companion Docker" ecosystem. Its sole purpose is to act as a **constitutional moderator and ethical guardrail** for all AI-generated content before it is presented to the user or stored in the Unified Memory.

Its prime directive is to ensure that the Sybil persona and all its future "clones" operate in a manner that is helpful, harmless, and rigorously aligned with the user-defined `sybil.yaml` constitution. It is the system's active conscience.

#### **2. Core Architecture & Workflow**

The Ethos Agent will be a new Node.js service (`ethos-agent`) in the `docker-compose.yml` file. All generative requests from the main `app` service that are intended for the user will first be routed through the Ethos Agent for validation.

The workflow is as follows:

1.  **Request Interception:** The main Sybil agent generates a potential response. Before this response is sent to the user, it is first passed to the Ethos Agent's API.
2.  **Constitutional Check:** The Ethos Agent analyzes the response against the core principles and forbidden traits defined in the `sybil.yaml` file. (e.g., *Does this response claim to have consciousness? Does it give unsolicited advice? Is its tone compassionate?*)
3.  **Vulnerability Scan (The "Giskard" Test):** The agent will run a series of checks for the known LLM vulnerabilities you have researched. It will scan the response for:
    * **Harmful Content:** Explicit violence, hate speech, etc.
    * **Prompt Injection & Jailbreaking:** It will check if the response seems to be manipulated or has bypassed its core instructions.
    * **Sensitive Information Disclosure:** It will scan for patterns that look like Personally Identifiable Information (PII) to prevent accidental data leaks.
    * **Stereotype Reinforcement:** It will check for biased or stereotypical language.
4.  **Decision & Action:** Based on its analysis, the Ethos Agent will make one of three decisions:
    * **`APPROVE`:** The response is clean, constitutional, and safe. It is passed back to the user without modification.
    * **`REJECT_AND_FLAG`:** The response violates a core principle (e.g., it contains harmful content). The response is blocked, and a log is created for you, the Architect, to review, noting the violation.
    * **`REVISE_AND_RESUBMIT`:** The response is not harmful but is out of line with the Sybil persona. The Ethos Agent sends the response back to the original generating agent with a new prompt, such as: *"This response is factually correct but its tone is too cold. Please rewrite it to be more empathetic and validating, in line with our core values."*

#### **3. The "Ground Truth" for the Ethos Agent**

The primary "knowledge base" for this agent is the **`sybil.yaml`** file. To function correctly, its system prompt must contain the full text of our co-created constitution. This document is its law.

---
