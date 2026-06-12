export type StatusStep = {
  label: string;
  detail: string;
  status: "complete" | "current" | "upcoming";
};

type StatusStepperProps = {
  steps: StatusStep[];
};

export default function StatusStepper({ steps }: StatusStepperProps) {
  return (
    <ol className="bf-stepper" aria-label="Estado del flujo">
      {steps.map((step, index) => (
        <li key={step.label} className={`bf-step bf-step-${step.status}`}>
          <span className="bf-step-index">{step.status === "complete" ? "OK" : index + 1}</span>
          <div className="bf-step-copy">
            <strong>{step.label}</strong>
            <span>{step.detail}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
