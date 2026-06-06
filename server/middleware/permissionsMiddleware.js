const VIEWER_ROLE = "viewer";

const blockViewerWrites = (req, res, next) => {
  if (req.user?.role === VIEWER_ROLE) {
    return res.status(403).json({
      message: "Viewer role has read-only access. You can only approve leave requests.",
    });
  }
  next();
};

module.exports = { blockViewerWrites, VIEWER_ROLE };
