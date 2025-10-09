const Team = require('../models/Team');
const User = require('../models/User');
const teamUpload = require('../middleware/teamUpload');

const createTeam = async (req, res) => {
  try {
    let { name, about, coach, members } = req.body;
    const photo = req.file ? `/uploads/teamavatars/${req.file.filename}` : null;

    // 🛠 Ensure members is always an array
    if (typeof members === "string") {
      try {
        members = JSON.parse(members); // agar JSON string aaya ho
      } catch {
        members = [members]; // single string ko array bana do
      }
    }
    if (!Array.isArray(members)) {
      members = [];
    }

    // ✅ Validate required fields
    if (!name || !coach) {
      return res.status(400).json({
        success: false,
        message: "Team name and coach are required",
      });
    }

    // ✅ Check if user is authorized
    const currentUser = req.user;
    if (
      currentUser.userRole !== "Admin" &&
      currentUser._id.toString() !== coach
    ) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: Coach can only select himself",
      });
    }

    // ✅ Validate coach
    const coachUser = await User.findById(coach);
    if (!coachUser) {
      return res.status(404).json({
        success: false,
        message: "Coach not found",
      });
    }
    if (coachUser.userRole !== "Coach") {
      return res.status(400).json({
        success: false,
        message: "Provided user is not a Coach",
      });
    }

    // ✅ Validate members
    if (members.length > 0) {
      const validMembers = await User.find({ _id: { $in: members } });
      if (validMembers.length !== members.length) {
        return res.status(400).json({
          success: false,
          message: "Some member IDs are invalid",
          invalidCount: members.length - validMembers.length,
        });
      }

      // ✅ Ensure all members are Players (not Coaches or others)
      const nonPlayerMembers = validMembers.filter(member => member.userRole !== "Player");
      if (nonPlayerMembers.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Only users with role 'Player' can be added as team members",
          invalidMembers: nonPlayerMembers.map(m => ({ id: m._id, role: m.userRole }))
        });
      }
    }

    // ✅ Create team
    const team = new Team({
      name,
      about,
      coach,
      members,
      photo,
    });

    await team.save();
    await team.populate("coach members", "username email userRole");

    return res.status(201).json({
      success: true,
      message: "Team created successfully",
      data: team,
    });
  } catch (error) {
    console.error("❌ Create Team Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error while creating team",
      error: error.message, // debug ke liye frontend ko send kar sakte ho
    });
  }
};


const toggleTeamStatus = async (req, res) => {
  try {
    const { teamId } = req.params;
    const currentUser = req.user;

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not found"
      });
    }

    // Authorization check
    const isAuthorized = 
      currentUser.userRole === "Admin" || 
      (currentUser.userRole === "Coach" && currentUser._id.toString() === team.coach.toString());

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: Only Admin or the team's coach can toggle status"
      });
    }

    // Store previous status for better response message
    const statusBeforeToggle = team.isActive;
    const actionTaken = statusBeforeToggle ? "deactivated" : "activated";
    
    // Toggle status
    team.isActive = !team.isActive;
    const updatedTeam = await team.save();

    return res.status(200).json({
      success: true,
      message: `Team ${updatedTeam.isActive ? "activated" : "deactivated"} successfully`,
      data: {
        teamId: updatedTeam._id,
        isActive: updatedTeam.isActive
      }
    });

  } catch (error) {
    console.error("❌ Toggle Team Status Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while toggling team status",
      error: error.message
    });
  }
};


const deleteTeam = async (req, res) => {
  try {
    const { teamId } = req.params;
    const currentUser = req.user; // auth middleware se

    // 1️⃣ Team find karo
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not found",
        error: "Team not found"
      });
    }

    // 2️⃣ Authorization check
    if (
      currentUser.userRole === "Admin"
    ) {
      // Admin -> allowed to delete any team
    } else if (
      currentUser.userRole === "Coach" &&
      currentUser._id.toString() === team.coach.toString()
    ) {
      // Coach -> allowed only for own team
    } else {
      // Unauthorized users
      return res.status(403).json({
        success: false,
        message: "Unauthorized: Only Admin or the team's coach can delete this team",
        error: "Unauthorized"
      });
    }

    // 3️⃣ Delete the team
    await Team.findByIdAndDelete(teamId);

    return res.status(200).json({
      success: true,
      message: "Team deleted successfully"
    });

  } catch (error) {
    console.error("❌ Delete Team Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while deleting team",
      error: error.message
    });
  }
};


// Get Teams List
// Unit-test points: Test with Admin (all teams), Coach (own teams), Others (empty/403), search, filter, pagination
// curl -X GET "http://localhost:5000/api/teams?searchText=teamName&isActive=false&page=1&limit=10" -H "Authorization: Bearer <token>"
const getTeams = async (req, res) => {
  try {
    const currentUser = req.user;
    const { searchText, isActive, page = 1, limit = 10 } = req.query;

    let query = {};

    // Role-based access
    if (currentUser.userRole === "Admin") {
      // Admin can see all teams
    } else if (currentUser.userRole === "Coach") {
      query.coach = currentUser._id; // Coach -> sirf apni teams
    } else {
      return res.status(200).json({
        success: true,
        message: "Teams fetched successfully",
        data: [],
        pagination: { 
          currentPage: 1, 
          perPage: 10, 
          totalRecords: 0, 
          totalPages: 0,
          hasNext: false,
          hasPrev: false
        }
      });
    }

    // Search by team name (space allow)
    if (searchText) {
      query.name = { $regex: searchText, $options: "i" };
    }

    // Filter by isActive (only if true/false diya ho)
    if (isActive === "true") {
      query.isActive = true;
    } else if (isActive === "false") {
      query.isActive = false;
    }

    const skip = (page - 1) * limit;
    const teams = await Team.find(query)
      .populate("coach", "username email avatar")
      .populate("members", "username avatar")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Add avatar paths for coach and members, and photo path for team
    teams.forEach(team => {
      if (team.photo) {
        if (!team.photo.startsWith('/')) {
          team.photo = `/uploads/teamavatars/${team.photo}`;
        }
      } else {
        team.photo = null;
      }
      if (team.coach) {
        team.coach.avatar = team.coach.avatar ? `/uploads/avatars/${team.coach.avatar}` : null;
      }
      if (team.members && team.members.length > 0) {
        team.members.forEach(member => {
          member.avatar = member.avatar ? `/uploads/avatars/${member.avatar}` : null;
        });
      }
    });

    const total = await Team.countDocuments(query);
    const totalPages = Math.ceil(total / limit);
    const currentPage = parseInt(page);

    return res.status(200).json({
      success: true,
      message: "Teams fetched successfully",
      data: teams,
      pagination: {
        currentPage,
        totalRecords: total,
        totalPages,
        hasNext: currentPage < totalPages,
        hasPrev: currentPage > 1
      }
    });
  } catch (error) {
    console.error("❌ Get Teams Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching teams",
      error: error.message
    });
  }
};

const updateTeam = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { name, about, existingPhoto } = req.body;
    
    // Parse members - handle both string and array
    let members = req.body.members;
    if (members) {
      if (typeof members === 'string') {
        try {
          members = JSON.parse(members);
        } catch (e) {
          members = [members];
        }
      }
      if (!Array.isArray(members)) {
        members = [members];
      }
    }
    
    // Photo handling - new file or existing path
    let photoPath = null;
    if (req.file) {
      // New file uploaded - create full path
      photoPath = `/uploads/teamavatars/${req.file.filename}`;
    } else if (existingPhoto) {
      // No new file - keep existing photo path
      photoPath = existingPhoto;
    }
    
    const currentUser = req.user;

    // Find the team
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not found",
        error: "Team not found"
      });
    }

    // Authorization check
    if (currentUser.userRole !== "Admin" && currentUser._id.toString() !== team.coach.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: Only Admin or the team's coach can update the team",
        error: "Unauthorized"
      });
    }

    // Validate members if provided
    if (members !== undefined) {
      if (!Array.isArray(members)) {
        return res.status(400).json({
          success: false,
          message: "Members must be an array"
        });
      }

      const validMembers = await User.find({ _id: { $in: members } });
      if (validMembers.length !== members.length) {
        return res.status(400).json({
          success: false,
          message: "Some member IDs are invalid",
          invalidCount: members.length - validMembers.length
        });
      }

      // Ensure all members are Players
      const nonPlayerMembers = validMembers.filter(member => member.userRole !== "Player");
      if (nonPlayerMembers.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Only users with role 'Player' can be added as team members",
          invalidMembers: nonPlayerMembers.map(m => ({ id: m._id, role: m.userRole }))
        });
      }

      team.members = members;
    }

    // Update other fields if provided
    if (name !== undefined) team.name = name;
    if (about !== undefined) team.about = about;
    if (photoPath !== null) team.photo = photoPath;

    await team.save();
    await team.populate("coach members", "username email userRole");

    return res.status(200).json({
      success: true,
      message: "Team updated successfully",
      data: team
    });
  } catch (error) {
    console.error("❌ Update Team Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while updating team",
      error: error.message
    });
  }
};

// Get a single team by ID
const getTeam = async (req, res) => {
  try {
    const { teamId } = req.params;
    const currentUser = req.user;

    const team = await Team.findById(teamId)
      .populate("coach", "username email avatar")
      .populate("members", "username avatar");

    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not found"
      });
    }

    // Authorization check: Admin can see all, Coach can see own teams, Members can see their teams
    const isAuthorized = 
      currentUser.userRole === "Admin" || 
      (currentUser.userRole === "Coach" && currentUser._id.toString() === team.coach._id.toString()) ||
      team.members.some(member => member._id.toString() === currentUser._id.toString());

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: You can only view teams you are associated with"
      });
    }

    // Add avatar paths for coach and members, and photo path for team
    if (team.photo) {
      if (!team.photo.startsWith('/')) {
        team.photo = `/uploads/teamavatars/${team.photo}`;
      }
    } else {
      team.photo = null;
    }
    if (team.coach) {
      team.coach.avatar = team.coach.avatar ? `/uploads/avatars/${team.coach.avatar}` : null;
    }
    if (team.members && team.members.length > 0) {
      team.members.forEach(member => {
        member.avatar = member.avatar ? `/uploads/avatars/${member.avatar}` : null;
      });
    }

    return res.status(200).json({
      success: true,
      message: "Team fetched successfully",
      data: team
    });
  } catch (error) {
    console.error("❌ Get Team Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching team",
      error: error.message
    });
  }
};

module.exports = { createTeam, toggleTeamStatus, deleteTeam, getTeams, updateTeam, getTeam };
