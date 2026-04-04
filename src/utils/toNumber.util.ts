export function toNumber(value: any): number | null {
        if (value === undefined || value === null || value === '') return null;

        const n = Number(value);
        return Number.isNaN(n) ? null : n;
}