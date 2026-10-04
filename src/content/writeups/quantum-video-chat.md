---
title: Quantum Video Chat
summary: Peer-to-peer video encrypted with keys from a simulated BB84 quantum key-distribution protocol — with live eavesdropper detection.
---

End-to-end encrypted, peer-to-peer video where the encryption keys are established through a **simulated BB84 quantum key-distribution** protocol rather than classical key exchange. Built during my research internship at Qualcomm Institute.

## How it works

The full QKD pipeline runs client-side:

1. **sifting** — keep only the bits where the two parties' bases matched;
2. **error estimation** — sample the quantum bit error rate (QBER);
3. **Cascade** error correction — reconcile the shared key over the public channel;
4. **Toeplitz** privacy amplification — hash out any information an eavesdropper could have gained.

The resulting key drives **AES-128-GCM** encryption of the WebRTC media streams via **Insertable Streams**.

## The security property

The protocol carries its own tamper alarm: **every frame whose QBER exceeds 7.3% is rejected**, and an intercept-resend eavesdropper lands near 25%, so a tapped channel mints nothing at all.

7.3% rather than the textbook 11%, because those two numbers measure different things. 11% is where BB84's own rate `1 − 2h(Q)` reaches zero, and it charges error correction the Shannon bound. Cascade does not reach that bound — at the block sizes here it discloses about 1.65 times `h(Q)` — so this implementation runs out of key budget first. The gate is computed from the leakage model rather than quoted from the literature, and above it no pool of any size yields a key. Below it the cost is steep but payable: a clean channel mints from a few thousand pooled bits, 5% needs tens of thousands, and 7% needs millions.

## What's real

The simulated channel is not an error-free one: it models Poisson photon statistics, fiber loss, APD dark counts and polarization misalignment, which leaves an undisturbed link at about 1.5% QBER. That is the point of modelling it — a channel with no errors would skip the error correction and the privacy amplification that the error rate pays for, and produce keys along a path no physical link offers.

Unit, integration and browser suites cover the signaling server, the bench daemon and the client, and CI gates every merge on them. Media encryption is frame-level and SFrame-aligned (RFC 9605); a dropped connection recovers by ICE restart without surrendering the key, and a self-hosted TURN relay carries calls that cannot connect peer to peer.

Beyond the simulator, the same engine drives an optical bench: emulated instruments behind driver interfaces, a daemon per peer, and a fiber link between them — so the classical reconciliation path is exercised by hardware-shaped input, not only by a simulation.

## Stack

Python signaling server and bench daemon · JavaScript client (BB84 simulation, WebRTC, Insertable Streams, Web Crypto AES-GCM).
