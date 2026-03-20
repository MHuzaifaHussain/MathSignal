# MathSignal

Interactive statistics, probability, and mathematics for AI/ML practitioners.

## What is this?

MathSignal is a documentation-style interactive reference for the mathematics behind AI and machine learning. Every concept is explained with intuition, visualization, formal math, and runnable code.

Topics covered:

- **Statistics** — descriptive statistics, distributions, hypothesis testing, regression
- **Probability** — Bayes' theorem, conditional probability, random variables, stochastic processes
- **Linear Algebra** — vectors, matrices, eigenvalues, SVD, transformations
- **Machine Learning** — gradient descent, loss functions, backpropagation, optimization

## Tech Stack

- [Astro Starlight](https://starlight.astro.build) — documentation framework
- [React](https://react.dev) — interactive components
- [Mafs](https://mafs.dev) — interactive math visualizations
- [KaTeX](https://katex.org) — math equation rendering
- [Tailwind CSS](https://tailwindcss.com) — utility-first styling
- [Marimo](https://marimo.io) — runnable Python notebooks

## Local Development

```bash
npm install
npm run dev       # start dev server at localhost:4321
npm run build     # production build to ./dist/
npm run preview   # preview production build locally
```

Requires Node.js v22 or higher.

## License

MIT
