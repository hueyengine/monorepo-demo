import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import Button from "./Button.vue";

describe("Button", () => {
  it("renders slot content", () => {
    const wrapper = mount(Button, {
      slots: { default: "Click me" },
    });
    expect(wrapper.text()).toBe("Click me");
  });

  it("applies the type class", () => {
    const wrapper = mount(Button, {
      props: { type: "primary" },
      slots: { default: "ok" },
    });
    expect(wrapper.classes()).toContain("r-button--primary");
  });

  it("emits click event on click", async () => {
    const wrapper = mount(Button, { slots: { default: "ok" } });
    await wrapper.trigger("click");
    expect(wrapper.emitted("click")).toHaveLength(1);
  });

  it("does not emit click when disabled", async () => {
    const wrapper = mount(Button, {
      props: { disabled: true },
      slots: { default: "ok" },
    });
    await wrapper.trigger("click");
    expect(wrapper.emitted("click")).toBeUndefined();
  });
});
