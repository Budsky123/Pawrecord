type SupabaseErrorLike = {
  code?: string;
  message?: string;
};

export function friendlyDatabaseError(error: SupabaseErrorLike) {
  switch (error.code) {
    case "23P01":
      return "That vet is already booked for this time. Please choose another slot.";
    case "42501":
      return "You do not have permission to complete this action.";
    case "23514":
      return "One of the entered values is not valid. Please check the details.";
    case "23503":
      return "The selected pet or vet is no longer available. Please refresh and try again.";
    case "23505":
      return "This record already exists.";
    default:
      return "We could not save that change. Please check the details and try again.";
  }
}
