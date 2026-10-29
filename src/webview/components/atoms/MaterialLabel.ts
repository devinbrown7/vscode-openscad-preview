import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";

declare global {
  interface HTMLElementTagNameMap {
    "scad-material-label": MaterialLabel;
  }
}

/**
 * The label that names a material in the preview. Plain, it only shows the
 * name. Pinned, the name is a copy button, and there is a dismiss button, and takes
 * pointer events so clicks on it don't reach the canvas behind it.
 *
 * Fires `copy` when the name is clicked, and `dismiss`
 * when the × is.
 */
@customElement("scad-material-label")
export class MaterialLabel extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 2px 6px;
      background: rgba(0, 0, 0, 0.65);
      color: white;
      font-size: 11px;
      font-family: monospace;
      border-radius: 3px;
      white-space: nowrap;
      pointer-events: none;
      /* The renderer sets the transform, so lift the label with a margin:
         its bottom edge clears the tip of the cursor arrow. */
      margin-top: -7px;
    }

    :host([pinned]) {
      pointer-events: auto;
    }

    .name {
      display: inline-block;
      min-width: 6ch;
    }

    button {
      padding: 0;
      border: none;
      background: transparent;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }

    .dismiss {
      margin-left: 6px;
      opacity: 0.7;
    }

    button:hover {
      opacity: 1;
      text-decoration: underline;
    }
  `;

  @property() name = "";
  @property({ type: Boolean, reflect: true }) pinned = false;
  /** Shows "copied" in place of the name, for a moment. */
  @property({ type: Boolean }) copied = false;

  constructor() {
    super();
    // The label sits over the canvas, but isn't part of it: keep a click
    // on the label from also being a click on the model.
    for (const type of ["pointerdown", "pointerup", "click", "wheel"]) {
      this.addEventListener(type, (e) => e.stopPropagation());
    }
  }

  render() {
    if (!this.pinned) return html`${this.name}`;
    return html`<button
        class="name"
        title="Copy the material name"
        @click=${this.copy}
      >
        ${this.copied ? "copied" : this.name}</button
      ><button
        class="dismiss"
        aria-label="Dismiss"
        title="Dismiss"
        @click=${this.dismiss}
      >
        ×
      </button>`;
  }

  private copy() {
    this.dispatchEvent(new Event("copy"));
  }

  private dismiss() {
    this.dispatchEvent(new Event("dismiss"));
  }
}
