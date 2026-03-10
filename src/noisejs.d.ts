declare module "noisejs" {
    interface Noise {
        seed(seed: number): void;
        simplex2(x: number, y: number): number;
        simplex3(x: number, y: number, z: number): number;
        perlin2(x: number, y: number): number;
        perlin3(x: number, y: number, z: number): number;
    }

    type NoiseConstructor = new (seed?: number) => Noise;

    const noisejs: {
        Noise: NoiseConstructor;
    };

    export default noisejs;
}
