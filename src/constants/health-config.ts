import {HealthConfig} from "../interfaces/health-config.interface";

export const healthConfig: HealthConfig = {
    speed: { weight: 0.1, optimal: [0, 80], critical: [80.1, 120] },
    fuel: { weight: 0.2, optimal: [100.1, 1000], critical: [0, 100] },
    pressure: { weight: 0.15, optimal: [0, 8.9], critical: [9, 20] },
    temp: {
        weight: 0.15,
            optimal: [75, 90],
            critical: [90.1, 100],
            contextualBands: [
            {
                when: [{ field: 'speed', op: 'lte', value: 1 }],
                optimal: [0, 100],
                critical: [100.1, 120],
            },
        ],
    },
    brake: { weight: 0.2, optimal: [65.1, 100], critical: [0, 65] },
    engine: { weight: 0.2, optimal: [65.1, 100], critical: [0, 65] },
};