interface PathNode {
    cost(): number;
    costTo(other: PathNode, fraction?: number): number;
    neighbours(): PathNode[];
}

class PathLocation {
    constructor(
        public o: PathNode,
        public fraction: number,
    ) {}
}

function cost(
    current: PathNode,
    next: PathNode,
    start: PathLocation,
    end: PathLocation,
) {
    let currentFraction: number | undefined;
    let nextFraction: number | undefined;

    if (start.o === end.o) {
        const fraction = Math.abs(start.fraction - end.fraction);
        return fraction * current.cost();
    }

    if (current === start.o) {
        currentFraction = start.fraction;
    }

    if (next === end.o) {
        nextFraction = end.fraction;
    }

    return (
        current.costTo(next, currentFraction) +
        next.costTo(current, nextFraction)
    );
}

const astar = {
    PathLocation,

    calc: {
        find(start: PathLocation, end: PathLocation) {
            const frontier: { item: PathNode; priority: number }[] = [
                { item: start.o, priority: 0 },
            ];

            const cameFrom = new Map<PathNode, PathNode | null>();
            cameFrom.set(start.o, null);

            const costSoFar = new Map<PathNode, number>();
            costSoFar.set(start.o, 0);

            while (frontier.length > 0) {
                frontier.sort((a, b) => a.priority - b.priority);
                const current = frontier.shift();
                if (current == null) {
                    break;
                }

                if (current.item === end.o) {
                    break;
                }

                for (const next of current.item.neighbours()) {
                    const currentCost = costSoFar.get(current.item);
                    if (currentCost == null) {
                        continue;
                    }

                    const newCost =
                        currentCost + cost(current.item, next, start, end);
                    const existingCost = costSoFar.get(next);

                    if (existingCost == null || newCost < existingCost) {
                        costSoFar.set(next, newCost);
                        const priority = newCost; // + heuristic(goal, next)
                        frontier.push({ item: next, priority });
                        cameFrom.set(next, current.item);
                    }
                }
            }

            console.log(`path cost: ${costSoFar.get(end.o)}`);

            // reconstruct path
            const path: PathNode[] = [end.o];
            let current: PathNode | null = end.o;

            while (current !== start.o) {
                current = cameFrom.get(current) ?? null;
                if (current == null) {
                    break;
                }

                path.unshift(current);
            }

            return path;
        },
    },
};

export default astar;
