// AGE-666 — the inline header thinking-level picker. The behaviours that matter:
// the compact trigger shows the active level title-cased, opening lists the six
// levels, and choosing one reports it. Verified through roles + the onChange
// callback; the level menu is a pure prop-driven component (no bridge calls).

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThinkingControl } from "./ThinkingControl";

it("shows the active level title-cased on the trigger", () => {
  render(<ThinkingControl level="medium" onChange={vi.fn()} />);
  expect(screen.getByRole("button", { name: "Medium" })).toBeInTheDocument();
});

it("opens the menu and lists every level", async () => {
  const user = userEvent.setup();
  render(<ThinkingControl level="medium" onChange={vi.fn()} />);

  await user.click(screen.getByRole("button", { name: "Medium" }));

  for (const name of ["Off", "Minimal", "Low", "Medium", "High", "Xhigh"]) {
    expect(screen.getByRole("menuitem", { name })).toBeInTheDocument();
  }
});

it("reports the chosen level and not the others", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<ThinkingControl level="medium" onChange={onChange} />);

  await user.click(screen.getByRole("button", { name: "Medium" }));
  await user.click(screen.getByRole("menuitem", { name: "High" }));

  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith("high");
});
