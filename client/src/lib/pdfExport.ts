import { jsPDF } from "jspdf";
import type { Meeting, Task, Project } from "@shared/schema";

interface ExportMeetingData {
  meeting: Meeting;
  tasks: Task[];
  projects: Project[];
}

export function exportMeetingToPDF(data: ExportMeetingData) {
  const { meeting, tasks, projects } = data;
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  let yPos = 20;

  const addPageIfNeeded = (requiredSpace: number) => {
    if (yPos + requiredSpace > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      yPos = 20;
    }
  };

  const wrapText = (text: string, maxWidth: number): string[] => {
    return doc.splitTextToSize(text, maxWidth);
  };

  // Title
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  const titleLines = wrapText(meeting.title, contentWidth);
  titleLines.forEach((line) => {
    doc.text(line, margin, yPos);
    yPos += 8;
  });
  yPos += 5;

  // Meeting metadata
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  doc.text(`Date: ${formatDate(meeting.date)}`, margin, yPos);
  yPos += 5;
  doc.text(`Participants: ${meeting.participants?.join(", ") || "N/A"}`, margin, yPos);
  yPos += 5;
  doc.text(`Effectiveness Score: ${meeting.effectivenessScore || 0}/10`, margin, yPos);
  yPos += 15;

  // Reset text color
  doc.setTextColor(0, 0, 0);

  // Summary section
  if (meeting.summary) {
    addPageIfNeeded(30);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Summary", margin, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const summaryLines = wrapText(meeting.summary, contentWidth);
    summaryLines.forEach((line) => {
      addPageIfNeeded(6);
      doc.text(line, margin, yPos);
      yPos += 5;
    });
    yPos += 10;
  }

  // Key Takeaways
  if (meeting.keyTakeaways && meeting.keyTakeaways.length > 0) {
    addPageIfNeeded(30);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Key Takeaways", margin, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    meeting.keyTakeaways.forEach((takeaway, index) => {
      const lines = wrapText(`${index + 1}. ${takeaway}`, contentWidth - 5);
      lines.forEach((line) => {
        addPageIfNeeded(6);
        doc.text(line, margin + 5, yPos);
        yPos += 5;
      });
    });
    yPos += 10;
  }

  // Topics Discussed
  if (meeting.topicsDiscussed && meeting.topicsDiscussed.length > 0) {
    addPageIfNeeded(30);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Topics Discussed", margin, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    meeting.topicsDiscussed.forEach((topic) => {
      const lines = wrapText(`• ${topic}`, contentWidth - 5);
      lines.forEach((line) => {
        addPageIfNeeded(6);
        doc.text(line, margin + 5, yPos);
        yPos += 5;
      });
    });
    yPos += 10;
  }

  // Action Items
  if (tasks.length > 0) {
    addPageIfNeeded(30);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Action Items", margin, yPos);
    yPos += 8;

    doc.setFontSize(10);
    tasks.forEach((task) => {
      addPageIfNeeded(15);
      doc.setFont("helvetica", "bold");
      const statusIcon = task.completed ? "[✓]" : "[ ]";
      const taskLines = wrapText(`${statusIcon} ${task.task}`, contentWidth - 5);
      taskLines.forEach((line, idx) => {
        doc.text(line, margin + 5, yPos);
        yPos += 5;
      });

      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      const details = [];
      if (task.owner) details.push(`Owner: ${task.owner}`);
      if (task.priority) details.push(`Priority: ${task.priority}`);
      if (task.due) details.push(`Due: ${task.due}`);
      if (details.length > 0) {
        doc.text(details.join(" | "), margin + 10, yPos);
        yPos += 5;
      }
      doc.setTextColor(0, 0, 0);
      yPos += 3;
    });
    yPos += 10;
  }

  // Projects
  if (projects.length > 0) {
    addPageIfNeeded(30);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Related Projects", margin, yPos);
    yPos += 8;

    doc.setFontSize(10);
    projects.forEach((project) => {
      addPageIfNeeded(15);
      doc.setFont("helvetica", "bold");
      doc.text(`• ${project.name}`, margin + 5, yPos);
      yPos += 5;

      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      const statusLabel = project.status === "open" ? "On Track" : project.status === "hold" ? "Blocked" : "Completed";
      doc.text(`Status: ${statusLabel}`, margin + 10, yPos);
      yPos += 5;

      // Find the update for this meeting
      const meetingUpdate = project.updates?.find(u => u.meetingId === meeting.id);
      if (meetingUpdate?.update) {
        const updateLines = wrapText(`Update: ${meetingUpdate.update}`, contentWidth - 15);
        updateLines.forEach((line) => {
          addPageIfNeeded(6);
          doc.text(line, margin + 10, yPos);
          yPos += 5;
        });
      }
      doc.setTextColor(0, 0, 0);
      yPos += 5;
    });
    yPos += 10;
  }

  // Meeting Effectiveness
  addPageIfNeeded(50);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Meeting Effectiveness", margin, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  // Score badge
  const score = meeting.effectivenessScore || 0;
  doc.text(`Score: ${score}/10`, margin + 5, yPos);
  yPos += 8;

  // What went well
  if (meeting.wentWell && meeting.wentWell.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.text("What Went Well:", margin + 5, yPos);
    yPos += 5;
    doc.setFont("helvetica", "normal");
    meeting.wentWell.forEach((item) => {
      const lines = wrapText(`+ ${item}`, contentWidth - 10);
      lines.forEach((line) => {
        addPageIfNeeded(6);
        doc.text(line, margin + 10, yPos);
        yPos += 5;
      });
    });
    yPos += 5;
  }

  // Areas to improve
  if (meeting.areasToImprove && meeting.areasToImprove.length > 0) {
    addPageIfNeeded(20);
    doc.setFont("helvetica", "bold");
    doc.text("Areas to Improve:", margin + 5, yPos);
    yPos += 5;
    doc.setFont("helvetica", "normal");
    meeting.areasToImprove.forEach((item) => {
      const lines = wrapText(`- ${item}`, contentWidth - 10);
      lines.forEach((line) => {
        addPageIfNeeded(6);
        doc.text(line, margin + 10, yPos);
        yPos += 5;
      });
    });
  }

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Generated by Omny - Page ${i} of ${totalPages}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
  }

  // Generate filename
  const sanitizedTitle = meeting.title
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .substring(0, 50);
  const dateStr = new Date(meeting.date).toISOString().split("T")[0];
  const filename = `${sanitizedTitle}_${dateStr}.pdf`;

  // Save the PDF
  doc.save(filename);
}
