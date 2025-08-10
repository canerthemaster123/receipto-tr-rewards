import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  type: 'receipt_approved' | 'receipt_rejected' | 'welcome';
  userId: string;
  receiptId?: string;
  data?: any;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, userId, receiptId, data }: EmailRequest = await req.json();
    
    console.log(`Processing email of type: ${type} for user: ${userId}`);

    // Get user profile and email
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId);
    if (authError || !authUser.user?.email) {
      console.error('Error fetching user:', authError);
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from('users_profile')
      .select('display_name')
      .eq('id', userId)
      .single();

    const userName = profile?.display_name || authUser.user.email?.split('@')[0] || 'User';
    const userEmail = authUser.user.email;

    let emailContent: { subject: string; html: string };

    switch (type) {
      case 'receipt_approved':
        const { data: approvedReceipt } = await supabase
          .from('receipts')
          .select('merchant, total, points, purchase_date')
          .eq('id', receiptId)
          .single();

        emailContent = {
          subject: "🎉 Your receipt has been approved!",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="margin: 0; font-size: 28px;">Receipt Approved! 🎉</h1>
              </div>
              
              <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb;">
                <h2 style="color: #374151; margin-top: 0;">Hi ${userName}!</h2>
                
                <p style="color: #6b7280; font-size: 16px; line-height: 1.6;">
                  Great news! Your receipt from <strong>${approvedReceipt?.merchant || 'Unknown Store'}</strong> has been approved and you've earned points!
                </p>
                
                <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
                  <h3 style="color: #374151; margin-top: 0;">Receipt Details:</h3>
                  <ul style="color: #6b7280; margin: 0; padding-left: 20px;">
                    <li><strong>Merchant:</strong> ${approvedReceipt?.merchant || 'N/A'}</li>
                    <li><strong>Amount:</strong> $${approvedReceipt?.total || '0.00'}</li>
                    <li><strong>Points Earned:</strong> ${approvedReceipt?.points || 0}</li>
                    <li><strong>Date:</strong> ${approvedReceipt?.purchase_date || 'N/A'}</li>
                  </ul>
                </div>
                
                <p style="color: #6b7280; font-size: 14px; margin-bottom: 0;">
                  Keep uploading receipts to earn more points and unlock amazing rewards!
                </p>
              </div>
            </div>
          `
        };
        break;

      case 'receipt_rejected':
        const { data: rejectedReceipt } = await supabase
          .from('receipts')
          .select('merchant, total, purchase_date')
          .eq('id', receiptId)
          .single();

        emailContent = {
          subject: "Receipt Review Update",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #ef4444, #dc2626); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="margin: 0; font-size: 28px;">Receipt Review Update</h1>
              </div>
              
              <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb;">
                <h2 style="color: #374151; margin-top: 0;">Hi ${userName},</h2>
                
                <p style="color: #6b7280; font-size: 16px; line-height: 1.6;">
                  We've reviewed your receipt from <strong>${rejectedReceipt?.merchant || 'Unknown Store'}</strong>, but unfortunately it doesn't meet our approval criteria at this time.
                </p>
                
                <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
                  <h3 style="color: #374151; margin-top: 0;">Receipt Details:</h3>
                  <ul style="color: #6b7280; margin: 0; padding-left: 20px;">
                    <li><strong>Merchant:</strong> ${rejectedReceipt?.merchant || 'N/A'}</li>
                    <li><strong>Amount:</strong> $${rejectedReceipt?.total || '0.00'}</li>
                    <li><strong>Date:</strong> ${rejectedReceipt?.purchase_date || 'N/A'}</li>
                  </ul>
                </div>
                
                <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <p style="color: #92400e; margin: 0; font-size: 14px;">
                    <strong>Common reasons for rejection:</strong><br>
                    • Receipt image is unclear or blurry<br>
                    • Receipt is from an excluded merchant<br>
                    • Receipt is duplicate or already submitted<br>
                    • Receipt is older than our acceptance policy
                  </p>
                </div>
                
                <p style="color: #6b7280; font-size: 14px; margin-bottom: 0;">
                  Please feel free to upload a new, clear receipt from an eligible merchant. Keep earning points!
                </p>
              </div>
            </div>
          `
        };
        break;

      case 'welcome':
        emailContent = {
          subject: "Welcome to Receipt Rewards! 🎁",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="margin: 0; font-size: 28px;">Welcome to Receipt Rewards! 🎁</h1>
              </div>
              
              <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb;">
                <h2 style="color: #374151; margin-top: 0;">Hi ${userName}!</h2>
                
                <p style="color: #6b7280; font-size: 16px; line-height: 1.6;">
                  Welcome to Receipt Rewards! We're excited to help you earn points and rewards for your everyday purchases.
                </p>
                
                <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
                  <h3 style="color: #374151; margin-top: 0;">How it works:</h3>
                  <ol style="color: #6b7280; margin: 0; padding-left: 20px;">
                    <li style="margin-bottom: 8px;">Upload photos of your receipts</li>
                    <li style="margin-bottom: 8px;">Earn points when receipts are approved</li>
                    <li style="margin-bottom: 8px;">Redeem points for amazing rewards</li>
                    <li>Refer friends to earn bonus points!</li>
                  </ol>
                </div>
                
                <div style="background: #dcfce7; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <p style="color: #166534; margin: 0; font-size: 14px;">
                    <strong>💡 Pro tip:</strong> Make sure your receipts are clear and legible for faster approval!
                  </p>
                </div>
                
                <p style="color: #6b7280; font-size: 14px; margin-bottom: 0;">
                  Ready to start earning? Upload your first receipt today!
                </p>
              </div>
            </div>
          `
        };
        break;

      default:
        return new Response(JSON.stringify({ error: 'Invalid email type' }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const emailResponse = await resend.emails.send({
      from: "Receipt Rewards <receipts@resend.dev>",
      to: [userEmail],
      subject: emailContent.subject,
      html: emailContent.html,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, messageId: emailResponse.data?.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in send-email function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);