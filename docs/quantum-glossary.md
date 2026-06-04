## Quantum Algorithm Glossary

Brief summaries of the quantum algorithms used across this portfolio:

**BB84 Quantum Key Distribution** -- A protocol for two parties (Alice and Bob) to generate a shared secret key using quantum mechanics. Alice sends photons polarized in random bases; Bob measures in random bases. They publicly compare bases (not results), keep only matching measurements, then perform error correction and privacy amplification. An eavesdropper disturbs the quantum states, raising the quantum bit error rate (QBER) above a detectable threshold (~11%).

**Grover's Algorithm** -- A quantum search algorithm that finds a marked item in an unsorted database of N items in O(sqrt(N)) steps, versus O(N) classically. In this project it solves nonogram puzzles by searching the solution space of valid grid configurations. An oracle marks correct solutions; amplitude amplification increases their measurement probability.

**Quantum Kernels** -- A technique in quantum machine learning where classical data is mapped into a high-dimensional quantum feature space via parameterized circuits. The kernel (inner product of quantum states) captures complex relationships that are hard to compute classically. Used here for protein sequence classification with hybrid quantum-classical models combining quantum feature maps with classical SVMs/neural networks.

---

<a id="main-site"></a>
