-- Enable RLS on operation_throttle table
ALTER TABLE public.operation_throttle ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for operation_throttle
CREATE POLICY "Users can view their own throttle records"
ON public.operation_throttle
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert throttle records"
ON public.operation_throttle
FOR INSERT
WITH CHECK (true);

CREATE POLICY "System can delete old throttle records"
ON public.operation_throttle
FOR DELETE
USING (true);