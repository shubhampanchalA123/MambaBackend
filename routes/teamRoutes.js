const express = require('express');
const { createTeam, toggleTeamStatus, deleteTeam, getTeams, updateTeam, getTeam } = require('../controllers/teamController');
const { protect } = require('../middleware/authMiddleware');
const teamUpload = require('../middleware/teamUpload');

const router = express.Router();

// GET /api/teams - List teams with search, filter, pagination
router.get('/', protect, getTeams);

// POST /api/teams
router.post('/addteam', protect, teamUpload.single('photo'), createTeam);

// PUT /api/teams/:teamId - Update team
router.put('/:teamId', protect, teamUpload.single('photo'), updateTeam);

// PUT /api/teams/:teamId/status - Toggle team status
router.put('/status/:teamId', protect, toggleTeamStatus);

// DELETE /api/teams/:teamId
router.delete('/:teamId', protect, deleteTeam);

// GET /api/teams/:teamId - Get a single team by ID
router.get('/:teamId', protect, getTeam);

module.exports = router;
