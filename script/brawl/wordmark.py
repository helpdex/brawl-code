import json

LETTERS = [
    ("b", "base", ["#...", "####", "#..#", "#ss#", "#ss#", "####", "...."]),
    ("r", "base", ["...", "###", "#..", "#..", "#..", "#..", "..."]),
    ("a", "base", ["....", "####", "...#", "####", "#ss#", "####", "...."]),
    ("w", "base", [".....", "#...#", "#...#", "#s#s#", "#s#s#", "#####", "....."]),
    ("l", "base", ["#", "#", "#", "#", "#", "#", "."]),
    ("c", "strong", ["....", "####", "#...", "#sss", "#sss", "####", "...."]),
    ("o", "strong", ["....", "####", "#..#", "#ss#", "#ss#", "####", "...."]),
    ("d", "strong", ["...#", "####", "#..#", "#ss#", "#ss#", "####", "...."]),
    ("e", "strong", ["....", "####", "#..#", "####", "#sss", "####", "...."]),
]

CELL = 6


def runs(row, mark):
    start = None
    for index, char in enumerate(row + "."):
        if char == mark and start is None:
            start = index
        if char != mark and start is not None:
            yield start, index
            start = None


def path(cells, x0, mark):
    parts = []
    for y, row in enumerate(cells):
        for a, b in runs(row, mark):
            left, top, width = x0 + a * CELL, y * CELL, (b - a) * CELL
            parts.append(f"M{left} {top}H{left + width}V{top + CELL}H{left}Z")
    return "".join(parts)


def outline(cells, x0, scale=1.0):
    filled = {(c, r) for r, row in enumerate(cells) for c, char in enumerate(row) if char == "#"}
    edges = {}
    for c, r in filled:
        if (c, r - 1) not in filled:
            edges.setdefault((c, r), []).append((c + 1, r))
        if (c + 1, r) not in filled:
            edges.setdefault((c + 1, r), []).append((c + 1, r + 1))
        if (c, r + 1) not in filled:
            edges.setdefault((c + 1, r + 1), []).append((c, r + 1))
        if (c - 1, r) not in filled:
            edges.setdefault((c, r + 1), []).append((c, r))
    loops = []
    while edges:
        start = min(edges)
        loop = [start]
        point = start
        while True:
            options = edges[point]
            nxt = options.pop()
            if not options:
                del edges[point]
            point = nxt
            if point == start:
                break
            loop.append(point)
        loops.append(
            [
                p
                for i, p in enumerate(loop)
                if not (
                    (loop[i - 1][0] == p[0] == loop[(i + 1) % len(loop)][0])
                    or (loop[i - 1][1] == p[1] == loop[(i + 1) % len(loop)][1])
                )
            ]
        )

    def fmt(value):
        text = f"{value * scale:.4f}".rstrip("0").rstrip(".")
        return text if text != "-0" else "0"

    parts = []
    for loop in sorted(loops):
        x, y = x0 + loop[0][0] * CELL, loop[0][1] * CELL
        commands = [f"M{fmt(x)} {fmt(y)}"]
        for px, py in loop[1:]:
            nx, ny = x0 + px * CELL, py * CELL
            commands.append(f"H{fmt(nx)}" if ny == y else f"V{fmt(ny)}")
            x, y = nx, ny
        parts.append("".join(commands) + "Z")
    return "".join(parts)


x = 0
letters = []
for name, fill, cells in LETTERS:
    width = len(cells[0]) * CELL
    letters.append(
        {
            "name": name,
            "cx": x + width / 2,
            "fill": fill,
            "stem": path(cells, x, "#"),
            "outline": outline(cells, x),
            "weak": path(cells, x, "s"),
            "x": x,
        }
    )
    x += width + CELL
total = x - CELL

grid = ["" for _ in range(14)]
for index, (name, fill, cells) in enumerate(LETTERS):
    for y, row in enumerate(cells):
        line = "".join({"#": "2" if fill == "base" else "3", "s": "1", ".": "."}[c] * 2 for c in row)
        if index < len(LETTERS) - 1:
            line += ".."
        grid[2 * y] += line
        grid[2 * y + 1] += line

large = 720 / total
x = 0
for letter, (name, fill, cells) in zip(letters, LETTERS):
    letter["outline720"] = outline(cells, x, large)
    x += len(cells[0]) * CELL + CELL

print(
    json.dumps(
        {"width": total, "height720": 42 * large, "letters": letters, "grid": grid, "cols": len(grid[0])}, indent=1
    )
)
