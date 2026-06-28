# ARESWEB Workspace Rules

## 1. Code Complexity Exceptions
- **Standalone Simulations**: Standalone interactive simulations located in `src/sims/` are exempt from the 500-line file complexity threshold. These modules combine complex physics equations, 2D/3D math solvers, and rendering logic into single sandboxed files. They should not be decomposed unless explicitly requested by the developer.
