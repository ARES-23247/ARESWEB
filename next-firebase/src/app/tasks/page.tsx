"use client";

import React from "react";
import { Navigate } from "react-router-dom";

export default function TasksRedirect() {
  return <Navigate to="/dashboard/tasks" replace />;
}
