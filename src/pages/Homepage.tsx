import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Cloud,
  Shield,
  Zap,
  BarChart3,
  ArrowRight,
  CheckCircle,
  Star,
  Monitor,
  Database,
  Settings } from
"lucide-react";
import { Link } from "react-router-dom";

const Homepage = () => {
  const features = [
  {
    icon: <Monitor className="h-6 w-6 text-primary" />,
    title: "Real-time Monitoring",
    description: "Monitor your AWS infrastructure in real-time with beautiful dashboards and instant alerts."
  },
  {
    icon: <Shield className="h-6 w-6 text-cloud-green" />,
    title: "Secure AWS Integration",
    description: "Connect securely using IAM roles and temporary credentials. Your data stays in your AWS account."
  },
  {
    icon: <BarChart3 className="h-6 w-6 text-cloud-purple" />,
    title: "Cost Optimization",
    description: "Track spending, identify cost drivers, and optimize your AWS resources automatically."
  },
  {
    icon: <Zap className="h-6 w-6 text-warning" />,
    title: "Performance Insights",
    description: "Get detailed performance metrics and recommendations to optimize your infrastructure."
  }];


  const testimonials = [
  {
    name: "Sarah Chen",
    role: "DevOps Engineer",
    company: "TechStartup",
    comment: "CloudHub transformed how we manage our AWS infrastructure. Setup took minutes, not hours.",
    rating: 5
  },
  {
    name: "Marcus Johnson",
    role: "CTO",
    company: "ScaleUp Inc",
    comment: "The cost optimization features alone saved us 30% on our monthly AWS bill.",
    rating: 5
  }];


  const technologies = [
  { name: "AWS", color: "aws-orange" },
  { name: "React", color: "cloud-cyan" },
  { name: "TypeScript", color: "primary" },
  { name: "Supabase", color: "cloud-green" },
  { name: "Tailwind", color: "cloud-purple" }];


  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/95 backdrop-blur">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary-glow rounded-lg flex items-center justify-center">
                <Cloud className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-foreground">CloudHub</h1>
              


            </div>
            <div className="flex items-center gap-4">
              <Link to="/auth">
                <Button variant="ghost">Sign In</Button>
              </Link>
              <Link to="/auth">
                <Button className="bg-gradient-to-r from-primary to-primary-glow hover:opacity-90">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto text-center max-w-4xl">
          <Badge className="mb-6 bg-gradient-to-r from-primary/10 to-primary-glow/10 border-primary/20 text-primary-glow"> Beta version

          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
            Your AWS Infrastructure,
            <span className="bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent"> Simplified</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Monitor, manage, and optimize your AWS resources from a beautiful, unified dashboard. 
            Get insights that matter, alerts that help, and control that scales.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/auth">
              <Button size="lg" className="bg-gradient-to-r from-primary to-primary-glow hover:opacity-90 text-lg px-8">
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="text-lg px-8">
              View Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Everything you need to manage AWS
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              From monitoring to cost optimization, we've got your entire AWS workflow covered.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) =>
            <Card key={index} className="border-border/50 hover:border-primary/20 transition-all duration-300 hover:shadow-lg">
                <CardContent className="p-6">
                  <div className="mb-4">{feature.icon}</div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </section>

      {/* Technologies Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">Built with Modern Technologies</h2>
          <p className="text-muted-foreground mb-12">
            Powered by industry-leading tools and frameworks for maximum reliability and performance.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            {technologies.map((tech, index) =>
            <Badge
              key={index}
              variant="outline"
              className={`px-4 py-2 text-sm border-${tech.color}/20 text-${tech.color} bg-${tech.color}/5`}>

                {tech.name}
              </Badge>
            )}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      






























      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="bg-gradient-to-br from-primary/10 to-primary-glow/10 border border-primary/20 rounded-2xl p-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Ready to transform your AWS experience?
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Join thousands of teams already using CloudHub to manage their infrastructure.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/auth">
                <Button size="lg" className="bg-gradient-to-r from-primary to-primary-glow hover:opacity-90 text-lg px-8">
                  Start Your Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
            <div className="flex items-center justify-center gap-6 mt-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">Free month trial
                <CheckCircle className="h-4 w-4 text-success" />
                Free 14-day trial
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                No credit card required
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                Cancel anytime
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-12 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-3 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary-glow rounded-lg flex items-center justify-center">
                <Cloud className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold text-foreground">CloudHub</span>
            </div>
            <p className="text-muted-foreground">
              © 2024 CloudHub. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>);

};

export default Homepage;