---
title: Colophon
summary: How this exhibit was made: the mathematics, the drawing tools, the type, and the machinery that builds and serves it.
---

# Colophon

Every glyph in this exhibit is computed. Nothing is drawn by hand. These are the tools that do
the computing, and the people whose work they stand on.

![One loop, B3, inked three ways: formal, as drawn throughout, and heavy.](fig:tools)

## The mathematics

The 13 points come from a numerical solution of the Tammes problem, found with
[NumPy](https://numpy.org) and [SciPy](https://scipy.org)'s SLSQP optimiser from many random
starts. Python then enumerates the Hamiltonian paths and loops, finds the configuration's
symmetries, and counts the glyphs with Burnside's lemma. A Node program checks that count
independently by scanning all 479,001,600 orderings for the Library.

The ideas belong to the people credited in the [Sources](../loops/#sources) of
*Thirty million loops*: Tammes, Musin and Tarasov, Hamilton, Burnside, Gauss, Croes, Llull and
others.

## The drawing

**[Penrose](https://penrose.cs.cmu.edu)** (Carnegie Mellon University, version 3.3.1) draws the
ink. Its three small languages split each picture into a *Domain* (what kinds of things exist),
a *Substance* (these 13 points, this loop) and a *Style* (how to draw them). The brush model
(momentum, pressure, the back-wash, halo and ink passes) is written as Penrose Style. In the
build, Penrose runs in Node with [jsdom](https://github.com/jsdom/jsdom); in the explorer, it
runs in your browser.

**[three.js](https://threejs.org)** draws the explorer's live 3D sphere. A small canvas
renderer, written for this project, draws the Library's sketches at about a millisecond
each. **[resvg](https://github.com/RazrFalcon/resvg)** turns figures into the PNG cards you
see when a page is shared.

## The photographs

The calligraphy in [*The written word as image*](../inspirations/) comes from the open-access
collections of The Metropolitan Museum of Art and other museums, by way of
[Wikimedia Commons](https://commons.wikimedia.org). Every picture is public domain or CC0. The
build keeps its own compressed copies, made with [sharp](https://sharp.pixelplumbing.com), and
each plate links to its Commons page for the full provenance, licence and resolution.

## The words and type

The essays are Markdown, turned into pages by [marked](https://marked.js.org) and a short build
script. Headings are set in **Cormorant Garamond** by Christian Thalmann; the text is
**EB Garamond**, Georg Duffner's revival of Claude Garamond's type. Both are served by
[Google Fonts](https://fonts.google.com) under the SIL Open Font License.

## The machinery

Development happens in [Docker](https://www.docker.com) containers (Node 22, Python 3.11),
used directly or as a [VS Code Dev Container](https://code.visualstudio.com/docs/devcontainers/containers).
On every change, [GitHub Actions](https://github.com/features/actions) runs the tests, builds
the site and publishes it on [GitHub Pages](https://pages.github.com).

{{build}}

## Made by

A collaboration between **Larry Kyrala** and **Claude**, Anthropic's AI model, working in
[Claude Code](https://www.anthropic.com/claude-code).

Larry conceived the project and directed it throughout: writing on an optimal sphere, the turn
from circles to loops, the visual story, the Library, and the eye for which glyphs are worth
keeping. Claude did the bulk of the making, under that direction: the mathematics in code,
the Penrose styles and brush model, the explorer and the Library, the essays, the figures,
and the site.

## Licences

The code is MIT-licensed and [on GitHub](https://github.com/coldnebo/sphere-glyphs). Penrose,
three.js, marked and jsdom are MIT-licensed; resvg-js is MPL-2.0; sharp is Apache-2.0; NumPy
and SciPy are BSD-licensed; the typefaces are under the SIL Open Font License. The photographs
of artworks are public domain or CC0, as recorded for each one in the site's media manifest.
