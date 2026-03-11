import Quadtree from "@timohausmann/quadtree-js";

import { CollisionObject, type CollisionLimits } from "../collision";
import config from "../config";
import math, { type Point } from "../math";

import { type Road } from "./segment";

type BuildingCorners = [Point, Point, Point, Point];

interface SegmentLike {
    r: Road;
    dir(): number;
    collider: CollisionObject;
}

function getCollisionLimits<T>(
    collider: CollisionObject,
    object: T,
): CollisionLimits<T> {
    return {
        ...collider.limits(),
        o: object,
    };
}

export class Building {
    center: Point;
    dir: number;
    diagonal: number;
    aspectDegree: number;
    corners: BuildingCorners;
    collider: CollisionObject<Building>;

    constructor(center: Point, dir: number, diagonal: number, aspectRatio = 1) {
        this.center = center;
        this.dir = dir;
        this.diagonal = diagonal;

        // degrees to deviate either end to produce desired aspect ratio
        this.aspectDegree = math.atanDegrees(aspectRatio);
        this.corners = this.generateCorners();
        this.collider = new CollisionObject(this, {
            type: "rect",
            corners: this.corners,
        });
    }

    generateCorners(): BuildingCorners {
        return [
            {
                x:
                    this.center.x +
                    this.diagonal *
                        math.sinDegrees(this.aspectDegree + this.dir),
                y:
                    this.center.y +
                    this.diagonal *
                        math.cosDegrees(this.aspectDegree + this.dir),
            },
            {
                x:
                    this.center.x +
                    this.diagonal *
                        math.sinDegrees(-this.aspectDegree + this.dir),
                y:
                    this.center.y +
                    this.diagonal *
                        math.cosDegrees(-this.aspectDegree + this.dir),
            },
            {
                x:
                    this.center.x +
                    this.diagonal *
                        math.sinDegrees(180 + this.aspectDegree + this.dir),
                y:
                    this.center.y +
                    this.diagonal *
                        math.cosDegrees(180 + this.aspectDegree + this.dir),
            },
            {
                x:
                    this.center.x +
                    this.diagonal *
                        math.sinDegrees(180 - this.aspectDegree + this.dir),
                y:
                    this.center.y +
                    this.diagonal *
                        math.cosDegrees(180 - this.aspectDegree + this.dir),
            },
        ];
    }

    setCenter(center: Point) {
        this.center = center;
        this.corners = this.generateCorners();
        this.collider.setCollision({ type: "rect", corners: this.corners });
    }

    setDir(dir: number) {
        this.dir = dir;
        this.corners = this.generateCorners();
        this.collider.setCollision({ type: "rect", corners: this.corners });
    }
}

function createImportBuilding() {
    return new Building({ x: 0, y: 0 }, 0, 150, math.randomRange(0.5, 2));
}

function createResidentialBuilding() {
    return new Building({ x: 0, y: 0 }, 0, 80, math.randomRange(0.5, 2));
}

function createBuildingFromProbability() {
    if (Math.random() < 0.4) {
        return createImportBuilding();
    }

    return createResidentialBuilding();
}

function createBuildingsAroundSegment(
    buildingTemplate: () => Building,
    segment: SegmentLike,
    count: number,
    radius: number,
    quadtree: Quadtree<CollisionLimits<Building | SegmentLike>>,
) {
    const buildings: Building[] = [];

    const placementLoopLimit =
        config.mapGeneration.BUILDING_PLACEMENT_LOOP_LIMIT;

    for (let i = 0; i < count; i += 1) {
        const randomAngle = Math.random() * 360;
        const randomRadius = Math.random() * radius;
        const buildingCenter = {
            x:
                0.5 * (segment.r.start.x + segment.r.end.x) +
                randomRadius * math.sinDegrees(randomAngle),
            y:
                0.5 * (segment.r.start.y + segment.r.end.y) +
                randomRadius * math.cosDegrees(randomAngle),
        };
        const building = buildingTemplate();
        building.setCenter(buildingCenter);
        building.setDir(segment.dir());

        let permitBuilding = false;

        for (let j = 0; j < placementLoopLimit; j += 1) {
            let collisionCount = 0;
            // must query quadtree here, since building limits may have changed due to collision in previous iteration
            const quadtreeCollisions = quadtree.retrieve(
                building.collider.limits(),
            );
            const potentialCollisions: (Building | SegmentLike)[] = [
                ...buildings,
            ];

            for (const collision of quadtreeCollisions) {
                if (collision.o != null) {
                    potentialCollisions.push(collision.o);
                }
            }

            for (const collidable of potentialCollisions) {
                const result = building.collider.collide(collidable.collider);
                if (result !== false && result != null) {
                    collisionCount += 1;

                    // no point continuing if on final loop
                    if (j === placementLoopLimit - 1) {
                        break;
                    }

                    if (typeof result !== "boolean") {
                        // shift building to avoid colliding with existing object
                        building.setCenter(
                            math.addPoints(building.center, result),
                        );
                    }
                }
            }

            // no further checks necessary
            if (collisionCount === 0) {
                permitBuilding = true;
                break;
            }
        }

        if (permitBuilding) {
            buildings.push(building);
        }
    }

    return buildings;
}

export function generateBuildings(segments: SegmentLike[]) {
    const qTree = new Quadtree<CollisionLimits<Building | SegmentLike>>(
        config.mapGeneration.QUADTREE_PARAMS,
        config.mapGeneration.QUADTREE_MAX_OBJECTS,
        config.mapGeneration.QUADTREE_MAX_LEVELS,
    );

    for (const segment of segments) {
        qTree.insert(getCollisionLimits(segment.collider, segment));
    }

    const buildings: Building[] = [];

    for (
        let i = 0;
        i < segments.length;
        i += config.mapGeneration.BUILDING_SEGMENT_PERIOD
    ) {
        const segment = segments[i];
        const newBuildings = createBuildingsAroundSegment(
            createBuildingFromProbability,
            segment,
            config.mapGeneration.BUILDING_COUNT_PER_SEGMENT,
            config.mapGeneration.MAX_BUILDING_DISTANCE_FROM_SEGMENT,
            qTree,
        );

        for (const building of newBuildings) {
            qTree.insert(getCollisionLimits(building.collider, building));
        }

        buildings.push(...newBuildings);
    }

    return buildings;
}
