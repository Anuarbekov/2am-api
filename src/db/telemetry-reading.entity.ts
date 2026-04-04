import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
} from 'typeorm';

@Entity('telemetry_readings')
export class TelemetryReading {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'timestamptz' })
    timestamp: Date;

    @Column({ type: 'float', nullable: true })
    temp: number;

    @Column({ type: 'float', nullable: true })
    pressure: number;

    @Column({ type: 'float', nullable: true })
    fuel: number;

    @Column({ type: 'float', nullable: true })
    speed: number;

    @CreateDateColumn()
    createdAt: Date;
}