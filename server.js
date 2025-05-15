const express = require("express");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const cardsPath = path.join(__dirname, "cards.json");
const usersPath = path.join(__dirname, "users.json");

// Helpers
function readCards() {
    const data = fs.readFileSync(cardsPath, "utf-8");
    return JSON.parse(data);
}
function writeCards(cards) {
    fs.writeFileSync(cardsPath, JSON.stringify(cards, null, 2), "utf-8");
}

// Middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return next({ name: "UnauthorizedError", message: "Missing token" });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return next({
                name: "UnauthorizedError",
                message: "Invalid or expired token",
            });
        }
        req.user = user;
        next();
    });
}

// Routes
app.get("/", (req, res) => {
    res.send("🎴 Card Game API is running! Try /cards or /getToken");
});

app.post("/getToken", (req, res, next) => {
    try {
        const { username, password } = req.body;
        const users = JSON.parse(fs.readFileSync(usersPath));
        const user = users.find(
            (u) => u.username === username && u.password === password
        );

        if (!user) {
            return res
                .status(401)
                .json({ errorMessage: "Invalid username or password" });
        }

        const token = jwt.sign({ username }, process.env.JWT_SECRET, {
            expiresIn: "1h",
        });
        res.json({ successMessage: "Token created", token });
    } catch (err) {
        next(err);
    }
});

app.get("/cards", (req, res, next) => {
    try {
        const cards = readCards();
        const query = req.query;

        const filtered = cards.filter((card) =>
            Object.entries(query).every(([key, val]) => card[key] === val)
        );

        res.json(filtered);
    } catch (err) {
        next(err);
    }
});

app.post("/cards/create", authenticateToken, (req, res, next) => {
    try {
        const newCard = req.body;
        const cards = readCards();

        if (cards.find((c) => c.cardId === newCard.cardId)) {
            return res
                .status(400)
                .json({ errorMessage: "Card ID must be unique" });
        }

        cards.push(newCard);
        writeCards(cards);
        res.json({
            successMessage: "Card created successfully",
            createdCard: newCard,
        });
    } catch (err) {
        next(err);
    }
});

app.put("/cards/:id", authenticateToken, (req, res, next) => {
    try {
        const cardId = req.params.id;
        const updatedData = req.body;
        const cards = readCards();
        const index = cards.findIndex((card) => card.cardId === cardId);

        if (index === -1) {
            return res.status(404).json({ errorMessage: "Card not found" });
        }

        // If the update includes a new cardId, make sure it's unique
        if (
            updatedData.cardId &&
            updatedData.cardId !== cardId &&
            cards.find((c) => c.cardId === updatedData.cardId)
        ) {
            return res
                .status(400)
                .json({ errorMessage: "New card ID must be unique" });
        }

        const updatedCard = { ...cards[index], ...updatedData };
        cards[index] = updatedCard;
        writeCards(cards);

        res.json({ successMessage: "Card updated", updatedCard });
    } catch (err) {
        next(err);
    }
});

app.delete("/cards/:id", authenticateToken, (req, res, next) => {
    try {
        const cardId = req.params.id;
        const cards = readCards();
        const index = cards.findIndex((card) => card.cardId === cardId);

        if (index === -1) {
            return res.status(404).json({ errorMessage: "Card not found" });
        }

        const deletedCard = cards.splice(index, 1)[0];
        writeCards(cards);

        res.json({ successMessage: "Card deleted", deletedCard });
    } catch (err) {
        next(err);
    }
});

// Bonus Routes
app.get("/sets", (req, res, next) => {
    try {
        const sets = [...new Set(readCards().map((c) => c.set))];
        res.json(sets);
    } catch (err) {
        next(err);
    }
});

app.get("/types", (req, res, next) => {
    try {
        const types = [...new Set(readCards().map((c) => c.type))];
        res.json(types);
    } catch (err) {
        next(err);
    }
});

app.get("/rarities", (req, res, next) => {
    try {
        const rarities = [...new Set(readCards().map((c) => c.rarity))];
        res.json(rarities);
    } catch (err) {
        next(err);
    }
});

app.get("/cards/count", (req, res, next) => {
    try {
        res.json({ count: readCards().length });
    } catch (err) {
        next(err);
    }
});

app.get("/cards/random", (req, res, next) => {
    try {
        const cards = readCards();
        const random = cards[Math.floor(Math.random() * cards.length)];
        res.json(random);
    } catch (err) {
        next(err);
    }
});

// Error Handler
app.use((err, req, res, next) => {
    console.error("❌ Error:", err);

    if (err.name === "UnauthorizedError" || err.name === "JsonWebTokenError") {
        return res
            .status(401)
            .json({ errorMessage: err.message || "Unauthorized" });
    }

    if (err.status && err.status >= 400 && err.status < 500) {
        return res
            .status(err.status)
            .json({ errorMessage: err.message || "Client error" });
    }

    res.status(500).json({
        errorMessage: "Something went wrong on the server.",
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
