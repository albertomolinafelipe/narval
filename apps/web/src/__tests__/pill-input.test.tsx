import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import PillInput from "@/app/_components/shared/pill-input";

describe("PillInput", () => {
  it("renders existing tags from comma-separated value", () => {
    render(<PillInput value="react,typescript" onChange={vi.fn()} />);
    expect(screen.getByText("react")).toBeInTheDocument();
    expect(screen.getByText("typescript")).toBeInTheDocument();
  });

  it("adds tag on Enter", () => {
    const onChange = vi.fn();
    render(<PillInput value="" onChange={onChange} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "nextjs" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("nextjs");
  });

  it("adds tag when comma typed", () => {
    const onChange = vi.fn();
    render(<PillInput value="" onChange={onChange} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "go," } });
    expect(onChange).toHaveBeenCalledWith("go");
  });

  it("removes tag on × click", () => {
    const onChange = vi.fn();
    render(<PillInput value="react,typescript" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Remove react"));
    expect(onChange).toHaveBeenCalledWith("typescript");
  });

  it("removes last tag on Backspace when input is empty", () => {
    const onChange = vi.fn();
    render(<PillInput value="react,typescript" onChange={onChange} />);
    const input = screen.getByRole("textbox");
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(onChange).toHaveBeenCalledWith("react");
  });
});
