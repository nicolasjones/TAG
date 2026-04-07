export interface Workflow {
  name: string;
  label: string;
  description?: string;
}

export interface Schedule {
  id: string;
  workflow_name: string;
  cron_expression?: string;
  interval_minutes?: number;
  isActive: boolean;
}
