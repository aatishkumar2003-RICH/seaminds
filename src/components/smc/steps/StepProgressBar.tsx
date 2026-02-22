interface StepProgressBarProps {
  currentStep: number;
  totalSteps: number;
  label: string;
}

const StepProgressBar = ({ currentStep, totalSteps, label }: StepProgressBarProps) => {
  const pct = (currentStep / totalSteps) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium">Step {currentStep} of {totalSteps}</span>
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

export default StepProgressBar;
