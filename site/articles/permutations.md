---
title: Thirty million loops
summary: How many glyphs are there, why so few are symmetric, and what the loops have in common with bracelets, ball games, and a puzzle Hamilton sold in 1859.
---

# Thirty million loops

Every glyph here is a loop: a single stroke that visits 13 points on a sphere, each one once,
and returns to where it started. How many such loops are there? The answer is **29,940,480**,
exactly. Getting there takes a short walk through some of the most beautiful ideas in
mathematics.

![Loop C, stepped by 4: one of the thirty million.](fig:cover)

## Thirteen dancers

![The six star polygons through 13 points. The filled point is where the ball starts.](fig:dancers)

Thirteen people stand in a circle. One throws a ball to the person *k* places to the left,
who does the same, and so on. Because 13 is prime, the ball reaches **everyone** before it
comes home, for any *k*. The path it traces is a star polygon, {13/*k*}.[^coxeter]

Throwing 3 places left looks the same as throwing 10 places right, so there are really only
6 stars, *k* = 1 to 6.

**Look further:** [star polygons](https://en.wikipedia.org/wiki/Star_polygon), and the
"times tables on a circle" that Mathologer made famous[^mathologer]
([interactive](https://www.redblobgames.com/x/1847-mathologer-modulo-circle/)).

## From a circle to a sphere

![The 13 points, joined wherever two sit as close as the arrangement allows: from the side, and from the top point.](fig:sphere)

A circle can hold 13 perfectly equal points. A sphere can't: no arrangement of 13 points on a
sphere makes every point look the same. The best it can do is spread them as far apart as
possible. That's the **Tammes problem**, first asked by a botanist studying pollen grains in
1930.[^tammes] For 13 points it was only proved in 2012.[^musin]

The winning arrangement keeps every pair of points at least 57.1° apart. It has a "top"
point, and it looks the same under **8 moves**: four quarter-turns about the top, and four
mirror reflections.

**Look further:** [the Tammes problem](https://en.wikipedia.org/wiki/Tammes_problem).

## Shuffling 13 cards

![One loop on a bracelet of 13 numbered beads: as written, turned, and flipped. Three different orders, one loop.](fig:bracelet)

Put the 13 points in any order and connect them in turn: that's a loop. There are
13 × 12 × 11 × … × 1 = **6,227,020,800** orders, a
[permutation](https://en.wikipedia.org/wiki/Permutation) count written 13!.[^stanley]

But many orders draw the same loop. You can start at any of the 13 points and go either way
round, so each loop is counted 26 times:

> 13! ÷ 26 = **239,500,800 loops**

It's the arithmetic of a bracelet of 13 different beads. Slide the beads round or flip the
bracelet over, and it's still the same bracelet.

**Look further:** [necklaces and bracelets](https://en.wikipedia.org/wiki/Necklace_(combinatorics)),
and the [dihedral group](https://en.wikipedia.org/wiki/Dihedral_group) behind them.

## The same glyph, turned

![One glyph carried by each of the sphere's 8 moves, seen from the top point. Top row: the four turns. Bottom row: the four mirror images. Eight different loops, one shape.](fig:orientations)

![One of the rare symmetric glyphs, seen from the top point: a half-turn carries it onto itself.](fig:symmetric)

Turn the sphere by one of its 8 moves and a loop becomes another loop that is plainly the
same shape. So divide by 8 again? Almost. A few loops look the same after a move, and they
would be undercounted.

The tool that counts exactly is **Burnside's lemma**:[^burnside] *the number of genuinely
different shapes is the average number of loops each move leaves unchanged.*

- Doing nothing leaves all 239,500,800 loops unchanged.
- The half-turn about the top point leaves **23,040** unchanged.
- Every other move leaves **none** unchanged.

Why only the half-turn? Flip a 13-point loop onto itself and exactly one of its points must
stay put, because 13 is odd. Only the half-turn keeps exactly one point (the top) in place.

> (239,500,800 + 23,040) ÷ 8 = **29,940,480 glyphs**[^count]

Of those, just **5,760** are symmetric. Every other glyph can be drawn in 8 different
orientations.

**Look further:** [Burnside's lemma](https://en.wikipedia.org/wiki/Burnside%27s_lemma). It
was known before Burnside, so it's sometimes called "the lemma that is not Burnside's."[^neumann]

## A road trip along the surface

![The only three loops that travel between neighbouring points: A, B and C.](fig:roadtrips)

Now allow only the shortest hops, between points that sit side by side on the sphere. A loop
becomes a road trip that visits every city once along real roads. Out of 30 million glyphs,
**only 3** can be drawn this way. We call them A, B and C.

In 1856 William Rowan Hamilton turned exactly this question into a puzzle: find a round trip
along the edges of a dodecahedron. It sold poorly, but the idea took his name. Loops like
these are called **Hamiltonian cycles**.[^biggs]

**Look further:** [the Icosian game](https://en.wikipedia.org/wiki/Icosian_game),
[Hamiltonian paths](https://en.wikipedia.org/wiki/Hamiltonian_path).

## Stars made from road trips

![The 18 family glyphs: each road trip, stepped by k = 1 to 6.](fig:families)

A road trip is also an order: city 0, city 1, … city 12. So play the ball game from the first
section on it. Visit every *k*-th city of loop A, and the loop leaves the surface and cuts
through the sphere. *k* = 1 is the road trip itself; *k* = 6 is the most tangled.

3 trips × 6 steps = 18 glyphs, the **families**.

There's a hidden algebra here. Stepping by 2 and then by 3 is the same as stepping by 6, so
the steps multiply. Arithmetic "mod 13" is a
[group](https://en.wikipedia.org/wiki/Group_(mathematics)), and every step can be built from
the step of 2 alone: 2, 4, 8, 3, 6, 12, 11, 9, 5, 10, 7, 1, then back to the start.[^gauss] Step
by 12 and you get the same loop backwards, which is why only 6 steps are different.

**Look further:** [the multiplicative group mod n](https://en.wikipedia.org/wiki/Multiplicative_group_of_integers_modulo_n),
[primitive roots](https://en.wikipedia.org/wiki/Primitive_root_modulo_n).

## Wandering

![Nine small steps away from A3. Each step reverses one stretch of the loop.](fig:wandering)

Pick any stretch of a loop and draw it backwards. Exactly two of its chords change, like two
pairs of dancers swapping partners. Repeat this and you can get from any loop to **any other**:
the 30 million glyphs form a single connected landscape.

The same move, called **2-opt**, has been used since 1958 to plan the shortest delivery
routes.[^croes]

**Look further:** [2-opt](https://en.wikipedia.org/wiki/2-opt), and the
[travelling salesman problem](https://en.wikipedia.org/wiki/Travelling_salesman_problem).

## Try it

![A wanderer from the gallery, drawn with less momentum.](fig:explore)

In the [explorer](../spike/), *random loop* picks one of the 239,500,800 loops and *mutate*
reverses one stretch. The code under the glyph is its name; the canonical code is the same
for all 8 orientations. If you find one worth keeping, share the link.

The drawings themselves are made with Penrose, a system that turns mathematical descriptions
into diagrams.[^penrose]

## Older than it looks

Rotating wheels of letters, combined to explore every possibility, go back to Ramon Llull
around 1300.[^llull] The circle-and-chord patterns go back to string art and curve
stitching.[^stringart] Shapes on a sphere cast into flat images live on in Henry Segerman's
stereographic projection sculptures.[^segerman] This project sits where they meet.

## Sources

[^coxeter]: H. S. M. Coxeter, *Regular Polytopes*, 3rd ed. (Dover, 1973). The notation {n/k} for star polygons.
[^mathologer]: Mathologer (Burkard Polster), "Times Tables, Mandelbrot and the Heart of Mathematics," video, 2015. Interactive version: [Red Blob Games](https://www.redblobgames.com/x/1847-mathologer-modulo-circle/); see also [Wolfram Demonstrations, "Modular Multiplication on a Circle"](https://demonstrations.wolfram.com/ModularMultiplicationOnACircle/).
[^tammes]: P. M. L. Tammes, "On the origin of number and arrangement of the places of exit on the surface of pollen-grains," *Recueil des travaux botaniques néerlandais* 27 (1930), 1–84.
[^musin]: O. R. Musin and A. S. Tarasov, "The strong thirteen spheres problem," *Discrete & Computational Geometry* 48 (2012), 128–141. [arXiv:1002.1439](https://arxiv.org/abs/1002.1439).
[^stanley]: R. P. Stanley, *Enumerative Combinatorics*, vol. 1, 2nd ed. (Cambridge University Press, 2011).
[^burnside]: W. Burnside, *Theory of Groups of Finite Order* (Cambridge University Press, 1897).
[^count]: The count is computed by this project's [`burnside.py`](https://github.com/coldnebo/sphere-glyphs/blob/main/src/burnside.py), checked against brute force on smaller cases.
[^neumann]: P. M. Neumann, "A lemma that is not Burnside's," *The Mathematical Scientist* 4 (1979), 133–141.
[^biggs]: N. L. Biggs, E. K. Lloyd and R. J. Wilson, *Graph Theory 1736–1936* (Oxford University Press, 1976). Includes Hamilton's Icosian game; see also [Wikipedia, "Icosian game"](https://en.wikipedia.org/wiki/Icosian_game).
[^gauss]: C. F. Gauss, *Disquisitiones Arithmeticae* (1801). Primitive roots and the multiplicative group modulo a prime.
[^croes]: G. A. Croes, "A method for solving traveling-salesman problems," *Operations Research* 6 (1958), 791–812.
[^penrose]: K. Ye, W. Ni, M. Krieger, D. Ma'ayan, J. Wise, J. Aldrich, J. Sunshine and K. Crane, "Penrose: From Mathematical Notation to Beautiful Diagrams," *ACM Transactions on Graphics* 39(4) (2020). [penrose.cs.cmu.edu](https://penrose.cs.cmu.edu).
[^llull]: "Ramon Llull," [*Stanford Encyclopedia of Philosophy*](https://plato.stanford.edu/entries/llull/); G. Crupi, ["Volvelles of knowledge"](https://iris.uniroma1.it/retrieve/e3835321-1611-15e8-e053-a505fe0a3de9/Crupi_Volvelles-of-knowledge_2019.pdf) (2019); and ["Combinatorial Wheels and Movable Alphabets: from Ramon Llull to Leon Battista Alberti"](https://dspace.ut.ee/items/56b006d0-8941-4dad-86b3-5d476d6671b3).
[^stringart]: [Wikipedia, "String art"](https://en.wikipedia.org/wiki/String_art), including Mary Everest Boole's curve stitching.
[^segerman]: H. Segerman, *Visualizing Mathematics with 3D Printing* (Johns Hopkins University Press, 2016); [Bridges gallery, stereographic projection sculptures](https://gallery.bridgesmathart.org/exhibitions/2016-joint-mathematics-meetings/henrys).
[^further]: Further reading: [Wikipedia, "Tammes problem"](https://en.wikipedia.org/wiki/Tammes_problem); [Burnside's lemma](https://en.wikipedia.org/wiki/Burnside%27s_lemma); [Necklace (combinatorics)](https://en.wikipedia.org/wiki/Necklace_(combinatorics)); [2-opt](https://en.wikipedia.org/wiki/2-opt).
