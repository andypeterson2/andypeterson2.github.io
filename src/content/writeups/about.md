---
title: The longer version
summary: How I got here, the research years, why the demos run in your browser, how I work, and what I'm after.
---

## How I got here

I got into computing through security clubs rather than coursework. I was running **ACM Cyber at UCSD** when campus closed in 2020 — a 500-member org that existed almost entirely through in-person meetings. Keeping it alive meant rebuilding how it ran: documentation people could actually find, and role-based access so officers could do their jobs without waiting on me. Around the same time a few of us started **San Diego CTF**, which grew into a competition with hundreds of players from more than twenty countries. I wrote the Discord bot everyone submitted through, on the theory that the fastest way to get people competing is to meet them where they already are.

## The research years

From 2022 to 2024 I was a research intern at the **Qualcomm Institute (CALIT2)**, working on quantum-secured communication. The centerpiece was a browser-native encrypted video system whose symmetric keys come from a **BB84 quantum key-distribution** exchange rather than classical Diffie–Hellman. The whole protocol runs in the browser over a WebRTC DataChannel: basis reconciliation and sifting, QBER estimation from a public sample, Cascade error correction, then Toeplitz privacy amplification down to a 128-bit key. That key drives **AES-128-GCM** encryption of the media frames through WebRTC Insertable Streams (`RTCRtpScriptTransform`, in a Web Worker), so frames are re-keyed with no SDP renegotiation and the latency cost stays low enough that a call still feels like a call.

Claiming a channel is secure is easy; showing it is not. So I built a simulated quantum optical channel with the parameters that actually matter — Poissonian photon statistics, ~0.2 dB/km fiber attenuation, single-photon detector efficiency — and an intercept-resend eavesdropper. Eve can't measure a qubit without disturbing the ones she forwards, which pushes the quantum bit error rate past the ~11% threshold where a secure key can no longer be distilled; the protocol sees the spike, throws the key away, and re-exchanges. Alongside that I worked on Grover-based quantum search for constraint problems — validated on real IBM hardware, where a 2×2 nonogram reached 32.3% correct-state probability against 6.25% by chance — and PyTorch classification pipelines. I presented the algorithmic work to IBM's VP of Quantum during a campus visit, and co-founded **Quantum Computing at UC San Diego** to give undergraduates somewhere to start.

## Why everything here runs in your browser

Every demo embedded on this page works with nothing running on my side. The nonogram solver's classical path is a real solver ported to JavaScript. The digit classifier runs a trained network's forward pass locally, on weights exported from the same model the backend serves. The quantum results are real measurements, computed once and committed. That was a deliberate constraint: a portfolio that only works while a server happens to be awake isn't a portfolio, it's a recurring bill. The live backends still exist for the parts that genuinely need them — they sit behind one gateway, scale to zero, and wake only for someone I've handed a link to.

## How I work

A few habits, most of them learned the hard way. Do the structural fix rather than patch around it — the shortcut is nearly always more expensive by the second time you touch it. Write the test at the seam where two components meet: one of the worst bugs I've chased was a handoff where one module called a method the other side never defined — each module was individually correct and individually tested, and nothing caught it because no test put them together. Treat security as a default rather than a feature — credentials stay server-side, every input that reaches a solver or a trainer is bounded, and a static site under a strict `Content-Security-Policy` beats one that trusts a CDN.

## What I'm after

A software engineering role on a small team shipping something with a real correctness or security bar: protocol code, inference that has to match the notebook, infrastructure that has to stay up. I'm most useful between research and production, where "it works on my machine" isn't an accepted answer. I'm in San Diego and open to remote.
