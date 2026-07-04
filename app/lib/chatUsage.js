function buildAssistantMessage(result, now = () => new Date()) {
  const message = {
    role: "assistant",
    content: result.content || "",
    time: now().toISOString(),
    model: result.model,
  };
  if (result.usage) {
    message.usage = result.usage;
  }
  if (result.skillRoute) {
    message.skillRoute = result.skillRoute;
  }
  if (result.chatIntent) {
    message.chatIntent = result.chatIntent;
  }
  return message;
}

module.exports = {
  buildAssistantMessage,
};
