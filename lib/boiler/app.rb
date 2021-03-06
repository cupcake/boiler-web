require 'rack-putty'
require 'omniauth-tent'
require 'securerandom'

module Boiler
  class App
    require 'boiler/app/middleware'
    require 'boiler/app/serialize_response'
    require 'boiler/app/asset_server'
    require 'boiler/app/render_view'
    require 'boiler/app/authentication'

    include Rack::Putty::Router

    stack_base SerializeResponse

    class Favicon < Middleware
      def action(env)
        env['REQUEST_PATH'].sub!(%r{/favicon}, "/assets/favicon")
        env['params'][:splat] = 'favicon.ico'
        env
      end
    end

    class CacheControl < Middleware
      def action(env)
        env['response.headers'] ||= {}
        env['response.headers'].merge!(
          'Cache-Control' => @options[:value].to_s,
          'Vary' => 'Cookie'
        )
        env
      end
    end

    class AccessControl < Middleware
      def action(env)
        env['response.headers'] ||= {}
        if @options[:allow_credentials]
          env['response.headers']['Access-Control-Allow-Credentials'] = 'true'
        end
        env['response.headers'].merge!(
          'Access-Control-Allow-Origin' => 'self',
          'Access-Control-Allow-Methods' => 'DELETE, GET, HEAD, PATCH, POST, PUT',
          'Access-Control-Allow-Headers' => 'Cache-Control, Pragma',
          'Access-Control-Max-Age' => '10000'
        )
        env
      end
    end

    class ContentSecurityPolicy < Middleware
      def action(env)
        env['response.headers'] ||= {}
        env['response.headers']["Content-Security-Policy"] = content_security_policy
        env
      end

      def content_security_policy_rules
        {
          "default-src" =>"'self'",
          "frame-ancestors" => "'self'",
          "frame-src" => "'self'",
          "object-src" => "'none'",
          "img-src" => "*",
          "connect-src" => "*"
        }
      end

      def content_security_policy
        content_security_policy_rules.inject([]) do |memo, (k,v)|
          memo << "#{k} #{v}"
          memo
        end.join('; ')
      end
    end

    get '/assets/*' do |b|
      b.use AssetServer
    end

    get '/favicon.ico' do |b|
      b.use Favicon
      b.use AssetServer
    end

    unless Boiler.settings[:skip_authentication]
      match %r{\A/auth/tent(/callback)?} do |b|
        b.use OmniAuth::Builder do
          provider :tent, {
            :get_app => AppLookup,
            :on_app_created => AppCreate,
            :app => {
              :name => Boiler.settings[:name],
              :description => Boiler.settings[:description],
              :url => Boiler.settings[:display_url],
              :redirect_uri => Boiler.settings[:redirect_uri],
              :read_types => Boiler.settings[:read_types],
              :write_types => Boiler.settings[:write_types],
              :scopes => Boiler.settings[:scopes]
            }
          }
        end
        b.use OmniAuthCallback
      end

      post '/auth/signout' do |b|
        b.use Signout
      end

      get '/auth/config.json' do |b|
        b.use AccessControl, :allow_credentials => true
        b.use CacheControl, :value => 'no-cache'
        b.use CacheControl, :value => 'private, max-age=600'
        b.use Authentication, :redirect => false
        b.use RenderView, :view => :'config.json', :content_type => "application/json"
      end
    end

    Boiler.settings[:layouts].each do |layout|
      get layout[:route] do |b|
        b.use ContentSecurityPolicy
        b.use Authentication
        b.use RenderView, :view => layout[:name]
      end
    end
  end
end
