"""Helpers for writing Penrose Substance text."""


def literals(values, step=1e-6):
    """Format numbers for one Substance statement, all distinct in value.

    Penrose binds the `Number` variables of a Style `forall` injectively, so a statement
    like At(v, 0, 0, 1), with two equal literals, never matches and the vertex silently
    disappears (-0 counts as 0). Nudge repeats by 1e-6 (~0.0002 px on the page) until
    every value is unique.
    """
    seen, out = set(), []
    for v in values:
        s = f"{v:.6f}"
        while float(s) in seen:
            v += step
            s = f"{v:.6f}"
        seen.add(float(s))
        out.append(s)
    return ", ".join(out)


def vertex_names(n):
    return [f"v{i:02d}" for i in range(n)]


def at_lines(x):
    names = vertex_names(len(x))
    return [f"At({names[i]}, {literals(p)})" for i, p in enumerate(x)]
