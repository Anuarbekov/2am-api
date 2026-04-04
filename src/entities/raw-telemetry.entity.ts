import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  Index,
  CreateDateColumn,
} from 'typeorm';

@Entity('raw_telemetry')
export class RawTelemetry {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'timestamptz' })
  @Index()
  timestamp!: Date;

  @Column({ type: 'float', nullable: true })
  fuel!: number | null;

  @Column({ type: 'float', nullable: true })
  pressure!: number | null;

  @Column({ type: 'float', nullable: true })
  temp!: number | null;

  @Column({ type: 'float', nullable: true })
  speed!: number | null;

  @Column({ type: 'int', default: 100 })
  quality!: number;

  @Column({ type: 'boolean', default: false })
  is_outlier!: boolean;

  @CreateDateColumn()
  created_at!: Date;
}
