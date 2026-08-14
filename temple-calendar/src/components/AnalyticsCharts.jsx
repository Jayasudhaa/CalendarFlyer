import React from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const AnalyticsCharts = () => {
  // Sample data
  const attendanceData = [
    { month: 'Sep', attendance: 245 },
    { month: 'Oct', attendance: 298 },
    { month: 'Nov', attendance: 320 },
    { month: 'Dec', attendance: 385 },
    { month: 'Jan', attendance: 410 },
    { month: 'Feb', attendance: 445 },
    { month: 'Mar', attendance: 520 }
  ];

  const conversionData = [
    { type: 'Pooja', conversion: 87 },
    { type: 'Abhishekam', conversion: 92 },
    { type: 'Festival', conversion: 78 },
    { type: 'Jayanti', conversion: 85 },
    { type: 'Special', conversion: 90 }
  ];

  const eventTypeData = [
    { name: 'Abhishekam', value: 35, color: '#10b981' },
    { name: 'Pooja', value: 28, color: '#f59e0b' },
    { name: 'Festival', value: 22, color: '#8b5cf6' },
    { name: 'Jayanti', value: 15, color: '#3b82f6' }
  ];

  const monthlyStats = [
    { label: 'Total Events', value: 24 },
    { label: 'Total RSVPs', value: 348 },
    { label: 'Avg Attendance', value: '87%' },
    { label: 'Engagement Rate', value: '92%' }
  ];

  return (
    <div className="space-y-6">
      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Attendance Trend */}
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-2xl">📊</span>
            <h3 className="text-lg font-bold text-slate-800">Event Attendance Trend</h3>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={attendanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" stroke="#64748b" style={{ fontSize: '12px' }} />
              <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1e293b', 
                  border: 'none', 
                  borderRadius: '8px',
                  color: '#fff'
                }} 
              />
              <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 600 }} />
              <Line 
                type="monotone" 
                dataKey="attendance" 
                stroke="#6366f1" 
                strokeWidth={3}
                dot={{ fill: '#6366f1', r: 5 }}
                activeDot={{ r: 7 }}
                name="Attendance"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* RSVP Conversion Rate */}
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-2xl">🎯</span>
            <h3 className="text-lg font-bold text-slate-800">RSVP Conversion Rate</h3>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={conversionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="type" stroke="#64748b" style={{ fontSize: '12px' }} />
              <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1e293b', 
                  border: 'none', 
                  borderRadius: '8px',
                  color: '#fff'
                }} 
              />
              <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 600 }} />
              <Bar 
                dataKey="conversion" 
                fill="url(#colorGradient)" 
                radius={[8, 8, 0, 0]}
                name="Conversion %"
              />
              <defs>
                <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={1}/>
                  <stop offset="100%" stopColor="#059669" stopOpacity={1}/>
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Popular Event Types */}
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-2xl">🔥</span>
            <h3 className="text-lg font-bold text-slate-800">Popular Event Types</h3>
          </div>
          <div className="flex items-center gap-8">
            <ResponsiveContainer width="60%" height={220}>
              <PieChart>
                <Pie
                  data={eventTypeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {eventTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1e293b', 
                    border: 'none', 
                    borderRadius: '8px',
                    color: '#fff'
                  }} 
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {eventTypeData.map((item, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div 
                    className="w-4 h-4 rounded-full" 
                    style={{ backgroundColor: item.color }}
                  />
                  <div>
                    <div className="font-bold text-slate-800 text-sm">{item.name}</div>
                    <div className="text-xs text-slate-500">{item.value}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Monthly Statistics */}
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-2xl">📅</span>
            <h3 className="text-lg font-bold text-slate-800">Monthly Statistics</h3>
          </div>
          <div className="space-y-4">
            {monthlyStats.map((stat, index) => (
              <div 
                key={index}
                className="flex justify-between items-center pb-4 border-b border-slate-200 last:border-0"
              >
                <span className="text-slate-600 font-medium text-sm">{stat.label}</span>
                <span className="text-2xl font-black text-slate-800">{stat.value}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Key Insights */}
      <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border-l-4 border-amber-500 rounded-2xl p-6 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">💡</span>
          <h4 className="text-lg font-bold text-amber-900">Key Insights</h4>
        </div>
        <ul className="space-y-3 text-amber-900">
          <li className="flex items-start gap-3">
            <span className="text-green-600 font-bold text-lg">✓</span>
            <span className="text-sm leading-relaxed">Abhishekam events have highest attendance with average of 45 people per event</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-green-600 font-bold text-lg">✓</span>
            <span className="text-sm leading-relaxed">Saturday events consistently get 2x more RSVPs compared to weekday events</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-green-600 font-bold text-lg">✓</span>
            <span className="text-sm leading-relaxed">RSVP conversion rate improved by 34% after adding QR codes to flyers</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-green-600 font-bold text-lg">✓</span>
            <span className="text-sm leading-relaxed">March shows 18% increase in participation compared to previous month</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default AnalyticsCharts;
