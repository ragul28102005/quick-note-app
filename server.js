
const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Notes storage path.
// Render can use a persistent disk mounted at /var/data.
const NOTES_FILE =
  process.env.NOTES_FILE ||
  (process.env.RENDER
    ? "/var/data/notes.json"
    : path.join(__dirname, "notes.json"));

// Static files are served from the public folder.
const PUBLIC_DIR = path.join(__dirname, "public");
const IMAGES_DIR = path.join(PUBLIC_DIR, "images");

const ALLOWED_CATEGORIES = [
  "Study",
  "Projects",
  "Personal",
  "Other"
];

// Check the public folder.
if (!fs.existsSync(PUBLIC_DIR)) {
  console.error("ERROR: public folder not found:", PUBLIC_DIR);
  console.error("Create a 'public' folder beside server.js.");
  process.exit(1);
}

// Middleware.
app.use(express.json({ limit: "1mb" }));

// Serve public files, including /images/pikachu.png.
app.use(express.static(PUBLIC_DIR));

// Ensure notes file and its directory exist.
function ensureNotesFile() {
  const directory = path.dirname(NOTES_FILE);

  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  if (!fs.existsSync(NOTES_FILE)) {
    fs.writeFileSync(NOTES_FILE, "[]", "utf8");
  }
}

// Read all notes safely.
function readNotes() {
  ensureNotesFile();

  const data = fs.readFileSync(NOTES_FILE, "utf8");
  const notes = JSON.parse(data || "[]");

  if (!Array.isArray(notes)) {
    throw new Error("Notes file must contain a JSON array");
  }

  return notes;
}

// Save all notes.
function saveNotes(notes) {
  ensureNotesFile();

  fs.writeFileSync(
    NOTES_FILE,
    JSON.stringify(notes, null, 2),
    "utf8"
  );
}

// Normalize category names.
function normalizeCategory(category) {
  if (typeof category !== "string") {
    return "Other";
  }

  const cleaned = category
    .trim()
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .trim()
    .toLowerCase();

  const categories = {
    study: "Study",
    studies: "Study",
    project: "Projects",
    projects: "Projects",
    personal: "Personal",
    other: "Other"
  };

  return categories[cleaned] || "Other";
}

// Validate note fields.
function validNoteFields(body) {
  const { title, content } = body || {};

  return (
    typeof title === "string" &&
    title.trim().length > 0 &&
    typeof content === "string" &&
    content.trim().length > 0
  );
}

// Return a note with a normalized category.
function formatNote(note) {
  return {
    ...note,
    category: normalizeCategory(note.category)
  };
}

// GET: Retrieve all notes.
app.get("/notes", (req, res) => {
  try {
    res.json(readNotes().map(formatNote));
  } catch (error) {
    console.error("Load notes error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to load notes"
    });
  }
});

// GET: Retrieve one note by ID.
app.get("/notes/:id", (req, res) => {
  try {
    const notes = readNotes();

    const note = notes.find(
      item => String(item.id) === String(req.params.id)
    );

    if (!note) {
      return res.status(404).json({
        success: false,
        message: "Note not found"
      });
    }

    res.json(formatNote(note));
  } catch (error) {
    console.error("Get note error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to load note"
    });
  }
});

// POST: Create a new note.
app.post("/notes", (req, res) => {
  try {
    if (!validNoteFields(req.body)) {
      return res.status(400).json({
        success: false,
        message: "Title and content are required"
      });
    }

    const { title, content } = req.body;
    const category = normalizeCategory(req.body.category);
    const notes = readNotes();

    const newNote = {
      id: `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,
      title: title.trim(),
      content: content.trim(),
      category,
      createdAt: new Date().toISOString()
    };

    notes.push(newNote);
    saveNotes(notes);

    res.status(201).json({
      success: true,
      message: "Note created successfully",
      note: newNote
    });
  } catch (error) {
    console.error("Add note error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to add note"
    });
  }
});

// PUT: Update an existing note.
app.put("/notes/:id", (req, res) => {
  try {
    if (!validNoteFields(req.body)) {
      return res.status(400).json({
        success: false,
        message: "Title and content are required"
      });
    }

    const notes = readNotes();

    const index = notes.findIndex(
      item => String(item.id) === String(req.params.id)
    );

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: "Note not found"
      });
    }

    const existingNote = notes[index];
    const { title, content } = req.body;

    const category =
      req.body.category !== undefined
        ? normalizeCategory(req.body.category)
        : normalizeCategory(existingNote.category);

    notes[index] = {
      ...existingNote,
      title: title.trim(),
      content: content.trim(),
      category,
      updatedAt: new Date().toISOString()
    };

    saveNotes(notes);

    res.json({
      success: true,
      message: "Note updated successfully",
      note: notes[index]
    });
  } catch (error) {
    console.error("Update note error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to update note"
    });
  }
});

// DELETE: Permanently delete a note.
app.delete("/notes/:id", (req, res) => {
  try {
    const notes = readNotes();

    const index = notes.findIndex(
      item => String(item.id) === String(req.params.id)
    );

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: "Note not found"
      });
    }

    const [deletedNote] = notes.splice(index, 1);

    saveNotes(notes);

    res.json({
      success: true,
      message: "Note deleted successfully",
      note: deletedNote
    });
  } catch (error) {
    console.error("Delete note error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to delete note"
    });
  }
});

// Handle invalid JSON and other errors.
app.use((error, req, res, next) => {
  if (
    error instanceof SyntaxError &&
    error.status === 400 &&
    "body" in error
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON request"
    });
  }

  console.error("Server error:", error);

  res.status(500).json({
    success: false,
    message: "Internal server error"
  });
});

// Start the server.
app.listen(PORT, "0.0.0.0", () => {
  console.log("----------------------------------");
  console.log("⚡ Pikachu Quick Notes App is running!");
  console.log(`Website: http://localhost:${PORT}`);
  console.log(`Server file: ${__filename}`);
  console.log(`Notes file: ${NOTES_FILE}`);
  console.log(`Public folder: ${PUBLIC_DIR}`);
  console.log(`Images folder: ${IMAGES_DIR}`);
  console.log("----------------------------------");
  console.log("GET    /notes");
  console.log("GET    /notes/:id");
  console.log("POST   /notes");
  console.log("PUT    /notes/:id");
  console.log("DELETE /notes/:id");
  console.log("Static files: /");
  console.log("----------------------------------");
});