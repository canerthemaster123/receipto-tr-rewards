import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/enhanced-button';
import { Link } from 'react-router-dom';
import { 
  Shield, 
  Users, 
  Receipt, 
  Settings, 
  ArrowLeft,
  CheckCircle,
  XCircle,
  Eye,
  UserCheck,
  BarChart,
  AlertTriangle
} from 'lucide-react';

const AdminHelp: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/admin">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin Panel
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Admin Guide
          </h1>
          <p className="text-muted-foreground mt-2">
            Complete guide to using the admin panel effectively
          </p>
        </div>
      </div>

      {/* Quick Access */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Admin Access
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">Getting Admin Access</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Only existing admins can grant admin roles</li>
                <li>• Admin access is required to view /admin routes</li>
                <li>• Role changes take effect immediately</li>
                <li>• Contact support if you need initial admin setup</li>
              </ul>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">Role Hierarchy</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <strong>Admin:</strong> Full access to all features</li>
                <li>• <strong>Moderator:</strong> Can review receipts</li>
                <li>• <strong>User:</strong> Standard user permissions</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Receipt Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Receipt Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Viewing Receipts</h3>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Click "View Details" to see full receipt info</li>
                <li>• Review merchant, amount, and date</li>
                <li>• Check for barcode and FİŞ NO if available</li>
                <li>• View uploaded receipt image</li>
              </ul>
            </div>
            
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <h3 className="font-semibold">Approving Receipts</h3>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Click "Approve" to accept a receipt</li>
                <li>• Awards 100 points to the user automatically</li>
                <li>• Updates user's total points instantly</li>
                <li>• Triggers email notification to user</li>
              </ul>
            </div>
            
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="h-4 w-4 text-red-600" />
                <h3 className="font-semibold">Rejecting Receipts</h3>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Click "Reject" for invalid receipts</li>
                <li>• No points are awarded</li>
                <li>• User can resubmit if needed</li>
                <li>• Sends rejection notification email</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-800 mb-2">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-semibold">Best Practices</span>
            </div>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>• Verify receipt authenticity before approving</li>
              <li>• Check that amounts and dates are reasonable</li>
              <li>• Look for clear merchant information</li>
              <li>• Reject blurry or unreadable receipts</li>
              <li>• Be consistent with approval standards</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* User Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            User Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <UserCheck className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Role Management</h3>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• View all users and their current roles</li>
                <li>• Promote users to moderator or admin</li>
                <li>• Demote users if needed</li>
                <li>• Changes take effect immediately</li>
              </ul>
            </div>
            
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <BarChart className="h-4 w-4 text-secondary" />
                <h3 className="font-semibold">User Analytics</h3>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• View total receipts per user</li>
                <li>• Check points earned and redeemed</li>
                <li>• Monitor user activity patterns</li>
                <li>• Track registration dates</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* QA Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            QA Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-center gap-2 text-orange-800 mb-2">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-semibold">Development & Testing Only</span>
            </div>
            <p className="text-sm text-orange-700 mb-3">
              These settings are for development and testing purposes only. Disable before production release.
            </p>
            
            <div className="space-y-3">
              <div>
                <h4 className="font-medium text-orange-800">Allow Duplicate Receipts</h4>
                <p className="text-xs text-orange-600">
                  Bypasses duplicate receipt validation for testing. Users can submit the same receipt multiple times.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart className="h-5 w-5" />
            Analytics & Reporting
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">Key Metrics</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Total active users</li>
                <li>• Pending receipts requiring review</li>
                <li>• Total points issued to date</li>
                <li>• Monthly revenue tracking</li>
              </ul>
            </div>
            
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">Report Features</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Receipt trends over time</li>
                <li>• Top retailers by volume</li>
                <li>• User engagement metrics</li>
                <li>• Points redemption patterns</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Emergency Procedures */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            Emergency Procedures
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <h3 className="font-semibold text-red-800 mb-2">If You Encounter Issues</h3>
            <ul className="text-sm text-red-700 space-y-1">
              <li>• Document the issue with screenshots</li>
              <li>• Note the time and user affected</li>
              <li>• Check browser console for error messages</li>
              <li>• Contact technical support immediately</li>
              <li>• Do not approve suspicious receipts</li>
            </ul>
          </div>
          
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-blue-800 mb-2">Getting Help</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Technical issues: Check browser console first</li>
              <li>• User complaints: Review their receipt history</li>
              <li>• Point discrepancies: Check points ledger</li>
              <li>• System downtime: Monitor status dashboard</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminHelp;