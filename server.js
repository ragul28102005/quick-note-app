
const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// File paths
const NOTES_FILE =
    process.env.NOTES_FILE ||
    (process.env.RENDER
        ? "/var/data/notes.json"
        : path.join(__dirname, "notes.json"));

const PUBLIC_DIR = path.join(__dirname, "public");

// Check that the frontend folder exists
if (!fs.existsSync(PUBLIC_DIR)) {
    console.error("ERROR: public folder not found:", PUBLIC_DIR);
    process.exit(1);
}

// Middleware
app.use(express.json({ limit: "1mb" }));
app.use(express.static(PUBLIC_DIR));

// Ensure the notes file and its directory exist
function ensureNotesFile() {
    const directory = path.dirname(NOTES_FILE);

    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
    }

    if (!fs.existsSync(NOTES_FILE)) {
        fs.writeFileSync(NOTES_FILE, "[]", "utf8");
    }
}

// Read notes
function readNotes() {
    ensureNotesFile();

    const data = fs.readFileSync(NOTES_FILE, "utf8");
    const notes = JSON.parse(data || "[]");

    if (!Array.isArray(notes)) {
        throw new Error("Notes file must contain a JSON array");
    }

    return notes;
}

// Save notes
function saveNotes(notes) {
    ensureNotesFile();

    fs.writeFileSync(
        NOTES_FILE,
        JSON.stringify(notes, null, 2),
        "utf8"
    );
}

// GET: All notes
app.get("/notes", (req, res) => {
    try {
        res.json(readNotes());
    } catch (error) {
        console.error("Load notes error:", error);
        res.status(500).json({
            success: false,
            message: "Unable to load notes"
        });
    }
});

// GET: One note by ID
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

        res.json(note);
    } catch (error) {
        console.error("Get note error:", error);
        res.status(500).json({
            success: false,
            message: "Unable to load note"
        });
    }
});

// POST: Add a note
app.post("/notes", (req, res) => {
    try {
        const { title, content } = req.body || {};

        if (
            typeof title !== "string" ||
            typeof content !== "string" ||
            !title.trim() ||
            !content.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Title and content are required"
            });
        }

        const notes = readNotes();

        const newNote = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            title: title.trim(),
            content: content.trim(),
            createdAt: new Date().toISOString()
        };

        notes.push(newNote);
        saveNotes(notes);

        res.status(201).json({
            success: true,
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

// PUT: Update a note
app.put("/notes/:id", (req, res) => {
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

        const { title, content } = req.body || {};

        if (
            typeof title !== "string" ||
            typeof content !== "string" ||
            !title.trim() ||
            !content.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Title and content are required"
            });
        }

        notes[index] = {
            ...notes[index],
            title: title.trim(),
            content: content.trim(),
            updatedAt: new Date().toISOString()
        };

        saveNotes(notes);

        res.json({
            success: true,
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

// DELETE: Delete a note permanently
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

        const deletedNote = notes.splice(index, 1)[0];
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

// Handle invalid JSON requests
app.use((error, req, res, next) => {
    if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
        return res.status(400).json({
            success: false,
            message: "Invalid JSON request"
        });
    }

    next(error);
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
    console.log("----------------------------------");
    console.log("Quick Note App is running!");
    console.log(`Port: ${PORT}`);
    console.log(`Website: http://localhost:${PORT}`);
    console.log(`Server file: ${__filename}`);
    console.log(`Notes file: ${NOTES_FILE}`);
    console.log("GET    /notes");
    console.log("GET    /notes/:id");
    console.log("POST   /notes");
    console.log("PUT    /notes/:id");
    console.log("DELETE /notes/:id");
    console.log("----------------------------------");
});