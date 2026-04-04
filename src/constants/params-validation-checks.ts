export const checks = [
    { field: 'fuel' as const, min: 0, max: 1000 },
    { field: 'pressure' as const, min: 0, max: 10 },
    { field: 'temp' as const, min: -200, max: 2000 },
    { field: 'speed' as const, min: 0, max: 120 },
    { field: 'brake' as const, min: 0, max: 100 },
    { field: 'engine' as const, min: 0, max: 100 },
];