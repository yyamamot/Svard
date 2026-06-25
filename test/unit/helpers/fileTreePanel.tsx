import { act } from "react";

export async function chooseFileViewModeIn(
  container: HTMLElement,
  reviewId: string,
): Promise<void> {
  await act(async () => {
    container
      .querySelector<HTMLButtonElement>(
        '[data-review-id="documents-view-toggle"]',
      )
      ?.click();
  });
  await act(async () => {
    container
      .querySelector<HTMLButtonElement>(`[data-review-id="${reviewId}"]`)
      ?.click();
  });
}
