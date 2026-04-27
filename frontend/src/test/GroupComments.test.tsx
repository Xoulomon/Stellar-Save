import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { GroupComments } from "../components/GroupComments";
import type { Comment } from "../components/GroupComments";

const CREATOR = "GCREATOR1234";
const USER = "GUSER5678";

const baseComments: Comment[] = [
  {
    id: "c1",
    authorAddress: CREATOR,
    authorName: "Alice",
    content: "Hello everyone!",
    timestamp: new Date("2024-01-15T10:00:00Z"),
  },
  {
    id: "c2",
    authorAddress: USER,
    authorName: "Bob",
    content: "**Bold** and *italic* and `code`",
    timestamp: new Date("2024-01-15T11:00:00Z"),
  },
];

function renderComments(
  overrides: Partial<Parameters<typeof GroupComments>[0]> = {},
) {
  const onPost = vi.fn();
  const onDelete = vi.fn();
  render(
    <GroupComments
      groupId="g1"
      comments={baseComments}
      currentUserAddress={USER}
      creatorAddress={CREATOR}
      onPost={onPost}
      onDelete={onDelete}
      {...overrides}
    />,
  );
  return { onPost, onDelete };
}

describe("GroupComments", () => {
  it("renders the comments section", () => {
    renderComments();
    expect(screen.getByRole("region", { name: "Group comments" })).toBeInTheDocument();
  });

  it("displays comment count", () => {
    renderComments();
    expect(screen.getByText("(2)")).toBeInTheDocument();
  });

  it("renders each comment", () => {
    renderComments();
    expect(screen.getByTestId("comment-c1")).toBeInTheDocument();
    expect(screen.getByTestId("comment-c2")).toBeInTheDocument();
  });

  it("shows author names", () => {
    renderComments();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("shows creator badge for creator's comment", () => {
    renderComments();
    expect(screen.getByTitle("Group creator")).toBeInTheDocument();
  });

  it("renders bold markdown", () => {
    renderComments();
    const comment = screen.getByTestId("comment-c2");
    expect(comment.querySelector("strong")).toBeInTheDocument();
    expect(comment.querySelector("strong")?.textContent).toBe("Bold");
  });

  it("renders italic markdown", () => {
    renderComments();
    const comment = screen.getByTestId("comment-c2");
    expect(comment.querySelector("em")?.textContent).toBe("italic");
  });

  it("renders inline code markdown", () => {
    renderComments();
    const comment = screen.getByTestId("comment-c2");
    expect(comment.querySelector("code")?.textContent).toBe("code");
  });

  it("shows empty state when no comments", () => {
    renderComments({ comments: [] });
    expect(screen.getByText(/No comments yet/)).toBeInTheDocument();
  });

  it("shows comment form when user is connected", () => {
    renderComments();
    expect(screen.getByLabelText("Comment text")).toBeInTheDocument();
    expect(screen.getByLabelText("Post comment")).toBeInTheDocument();
  });

  it("shows login prompt when no user connected", () => {
    renderComments({ currentUserAddress: undefined });
    expect(screen.getByText(/Connect your wallet/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Comment text")).not.toBeInTheDocument();
  });

  it("Post button is disabled when textarea is empty", () => {
    renderComments();
    expect(screen.getByLabelText("Post comment")).toBeDisabled();
  });

  it("Post button enables when text is entered", () => {
    renderComments();
    fireEvent.change(screen.getByLabelText("Comment text"), {
      target: { value: "Hello!" },
    });
    expect(screen.getByLabelText("Post comment")).not.toBeDisabled();
  });

  it("calls onPost with trimmed content and clears input", () => {
    const { onPost } = renderComments();
    const textarea = screen.getByLabelText("Comment text");
    fireEvent.change(textarea, { target: { value: "  My comment  " } });
    fireEvent.click(screen.getByLabelText("Post comment"));
    expect(onPost).toHaveBeenCalledWith("My comment");
    expect((textarea as HTMLTextAreaElement).value).toBe("");
  });

  it("does not call onPost when content is only whitespace", () => {
    const { onPost } = renderComments();
    fireEvent.change(screen.getByLabelText("Comment text"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByLabelText("Post comment"));
    expect(onPost).not.toHaveBeenCalled();
  });

  it("shows delete button for own comment", () => {
    renderComments();
    // Bob (USER) can delete their own comment c2
    expect(screen.getByLabelText(/Delete comment by Bob/)).toBeInTheDocument();
  });

  it("creator can delete any comment", () => {
    // Render as creator
    renderComments({ currentUserAddress: CREATOR });
    // Creator can delete both comments
    expect(screen.getAllByRole("button", { name: /Delete comment/ })).toHaveLength(2);
  });

  it("calls onDelete with comment id", () => {
    const { onDelete } = renderComments();
    fireEvent.click(screen.getByLabelText(/Delete comment by Bob/));
    expect(onDelete).toHaveBeenCalledWith("c2");
  });

  it("does not render deleted comments", () => {
    const comments: Comment[] = [
      { ...baseComments[0], deleted: true },
      baseComments[1],
    ];
    renderComments({ comments });
    expect(screen.queryByTestId("comment-c1")).not.toBeInTheDocument();
    expect(screen.getByTestId("comment-c2")).toBeInTheDocument();
  });

  it("shows short address when no authorName", () => {
    const comments: Comment[] = [
      {
        id: "c3",
        authorAddress: "GABCDEFGHIJKLMNOP",
        content: "Anonymous",
        timestamp: new Date(),
      },
    ];
    renderComments({ comments });
    expect(screen.getByText("GABCDE…MNOP")).toBeInTheDocument();
  });

  it("shows character count", () => {
    renderComments();
    fireEvent.change(screen.getByLabelText("Comment text"), {
      target: { value: "Hello" },
    });
    expect(screen.getByText("5/500")).toBeInTheDocument();
  });
});
