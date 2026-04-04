export interface ProcessedTelemetry {
    fuel: number;
    pressure: number;
    temp: number;
    speed: number;
    brake: number;
    engine: number;
    confidence?: number;
}